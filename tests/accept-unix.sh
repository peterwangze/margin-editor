#!/usr/bin/env bash
set -euo pipefail

platform=$1
arch=$2
version=$(node -p 'require("./package.json").version')
tmp=$(mktemp -d)
export MARGIN_EVIDENCE=$3
mkdir -p "$MARGIN_EVIDENCE"
mount_path="$tmp/dmg"
dmg_mounted=false
installed_deb=''

cleanup() {
  if [[ "$dmg_mounted" == true ]]; then hdiutil detach "$mount_path" >/dev/null; fi
  if [[ -n "$installed_deb" ]]; then sudo dpkg --remove "$installed_deb"; fi
  rm -rf -- "$tmp"
}
trap cleanup EXIT

exercise() {
  export MARGIN_PACKAGE_FORM=$1
  export MARGIN_EXECUTABLE=$2
  if [[ "$platform" == linux ]]; then
    # Enter a fresh network namespace, then drop back to the runner account.
    # Only loopback is enabled so the driver can talk to the local app.
    sudo --preserve-env=MARGIN_PACKAGE_FORM,MARGIN_EXECUTABLE,MARGIN_EVIDENCE,APPIMAGE_EXTRACT_AND_RUN,PATH \
      unshare --net bash -c 'ip link set lo up; exec runuser -u "$1" -- xvfb-run -a "$2" tests/packaged-smoke.mjs' \
      bash "$(id -un)" "$(command -v node)"
  else
    node tests/packaged-smoke.mjs
  fi
}

check_mac_bundle() {
  local app=$1
  local binary="$app/Contents/MacOS/Margin"
  local macho_arch=$arch
  if [[ "$macho_arch" == x64 ]]; then macho_arch=x86_64; fi
  [[ "$(lipo -archs "$binary")" == "$macho_arch" ]]
  [[ "$(plutil -extract CFBundleShortVersionString raw "$app/Contents/Info.plist")" == "$version" ]]
  [[ "$(plutil -extract CFBundleIdentifier raw "$app/Contents/Info.plist")" == "io.github.peterwangze.margin" ]]
  test -s "$app/Contents/Resources/app.asar"
  test -d "$app/Contents/Frameworks/Electron Framework.framework"
  codesign --verify --deep --strict "$app"
  codesign -dv "$app" 2>&1 | sed -n '/^Signature=/p; /^TeamIdentifier=/p'
}

case "$platform" in
  mac)
    dmg="release/Margin-$version-mac-$arch.dmg"
    archive="release/Margin-$version-mac-$arch.zip"
    hdiutil verify "$dmg"
    hdiutil attach "$dmg" -readonly -nobrowse -mountpoint "$mount_path"
    dmg_mounted=true
    mkdir -p "$tmp/Applications" "$tmp/zip"
    ditto "$mount_path/Margin.app" "$tmp/Applications/Margin.app"
    hdiutil detach "$mount_path"
    dmg_mounted=false
    ditto -x -k "$archive" "$tmp/zip"
    check_mac_bundle "$tmp/Applications/Margin.app"
    check_mac_bundle "$tmp/zip/Margin.app"
    exercise dmg "$tmp/Applications/Margin.app/Contents/MacOS/Margin"
    exercise zip "$tmp/zip/Margin.app/Contents/MacOS/Margin"
    MARGIN_EXECUTABLE="$tmp/Applications/Margin.app/Contents/MacOS/Margin" npm run test:desktop
    rm -r -- "$tmp/Applications/Margin.app"
    test ! -e "$tmp/Applications/Margin.app"
    printf '%s\n' 'DMG verification, mount, copy and removal; ZIP extraction; Mach-O architecture, bundle version, bundled runtime and ad hoc signature verified.' > "$MARGIN_EVIDENCE/package-checks.txt"
    ;;
  linux)
    deb_arch=$arch
    appimage_arch=$arch
    if [[ "$arch" == x64 ]]; then
      deb_arch=amd64
      appimage_arch=x86_64
    fi
    deb="release/Margin-$version-linux-$deb_arch.deb"
    appimage="$PWD/release/Margin-$version-linux-$appimage_arch.AppImage"
    [[ "$(dpkg-deb -f "$deb" Architecture)" == "$deb_arch" ]]
    [[ "$(dpkg-deb -f "$deb" Version)" == "$version" ]]
    package_name=$(dpkg-deb -f "$deb" Package)
    if dpkg-query -W -f='${db:Status-Status}' "$package_name" 2>/dev/null | grep -qx installed; then
      printf 'Package %s is already installed\n' "$package_name" >&2
      exit 1
    fi
    installed_deb=$package_name
    sudo unshare --net dpkg --install "$deb"
    mapfile -t paths < <(dpkg-query -L "$package_name")
    exe=''
    for item in "${paths[@]}"; do
      if [[ "$item" == /opt/*/margin && -x "$item" ]]; then exe=$item; fi
    done
    test -n "$exe"
    machine=$(LC_ALL=C readelf -h "$exe" | sed -n 's/^ *Machine: *//p')
    case "$arch:$machine" in
      x64:*X86-64|arm64:AArch64) ;;
      *) printf 'Unexpected ELF machine %s for %s\n' "$machine" "$arch" >&2; exit 1 ;;
    esac
    test -s "$(dirname "$exe")/resources/app.asar"
    test -s "$(dirname "$exe")/icudtl.dat"
    desktop-file-validate "/usr/share/applications/margin.desktop"
    exercise deb "$exe"
    MARGIN_EXECUTABLE="$exe" xvfb-run -a npm run test:desktop
    sudo dpkg --remove "$package_name"
    installed_deb=''
    test ! -e "$exe"
    chmod +x "$appimage"
    file "$appimage"
    # Hosted runners do not expose /dev/fuse. Use the documented extraction mode.
    APPIMAGE_EXTRACT_AND_RUN=1 exercise appimage "$appimage"
    printf '%s\n' 'DEB metadata, ELF architecture, bundled runtime, desktop entry, install and removal verified. AppImage launched in extraction mode. Both app forms exercised with only loopback networking.' > "$MARGIN_EVIDENCE/package-checks.txt"
    ;;
  *) printf 'Unsupported platform %s\n' "$platform" >&2; exit 1 ;;
esac
