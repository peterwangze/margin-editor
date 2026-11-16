Margin 1.6.0 shows the installed version in the title bar. Click **v1.6.0** to open **About Margin**, or choose **Help → Check for updates** to compare your installed version with the latest stable release and read its release notes. **Star on GitHub** in About opens the project page.

When an update is available, **Download update** saves the package for your operating system and architecture to Downloads after verifying its SHA-256. Open the downloaded installer or portable app when you're ready. Checking and downloading updates requires an Internet connection. Editing works offline.

Margin 1.6.0 在标题栏显示已安装版本。点击 **v1.6.0** 打开「关于 Margin」，或通过「帮助 → 检查更新」查看最新正式版和发行说明。有新版时，点击「下载更新」获取匹配系统和架构的安装包。校验通过后，包会保存在「下载」文件夹，可自行打开安装包或便携版。「关于 Margin」里的「在 GitHub 上加星」可打开项目主页。检查和下载更新需要联网，编辑可离线使用。

Margin supports 14 interface languages, including Arabic with right-to-left menus, Hindi, and Indonesian. Choose your language under **Settings → Preferences → Interface language**.

## Offline downloads / 离线安装包

| Platform | Intel / AMD 64-bit | ARM64 |
| --- | --- | --- |
| Windows | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v1.6.0/Margin-1.6.0-win-x64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v1.6.0/Margin-1.6.0-win-x64-portable.exe) | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v1.6.0/Margin-1.6.0-win-arm64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v1.6.0/Margin-1.6.0-win-arm64-portable.exe) |
| macOS | [DMG](https://github.com/peterwangze/margin-editor/releases/download/v1.6.0/Margin-1.6.0-mac-x64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v1.6.0/Margin-1.6.0-mac-x64.zip) | [Apple Silicon DMG](https://github.com/peterwangze/margin-editor/releases/download/v1.6.0/Margin-1.6.0-mac-arm64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v1.6.0/Margin-1.6.0-mac-arm64.zip) |
| Linux | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v1.6.0/Margin-1.6.0-linux-x86_64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v1.6.0/Margin-1.6.0-linux-amd64.deb) | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v1.6.0/Margin-1.6.0-linux-arm64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v1.6.0/Margin-1.6.0-linux-arm64.deb) |

[SHA-256 checksums](https://github.com/peterwangze/margin-editor/releases/download/v1.6.0/SHA256SUMS.txt) · [Platform acceptance screenshots and results](https://github.com/peterwangze/margin-editor/releases/download/v1.6.0/ACCEPTANCE.zip)

Choose the package for your processor. The packages carry the runtime and local assets; `SHA256SUMS.txt` covers every binary. Linux requires the host's desktop libraries. On Linux without FUSE, run the AppImage with `--appimage-extract-and-run`.

Windows builds lack a publisher signature, and macOS builds are ad hoc signed without notarization. Verify the SHA-256 before opening; your OS or organization may require approval to launch. Notepad++'s native Windows plugins and original macro files are outside this release's compatibility.

[Product research and scope](https://github.com/peterwangze/margin-editor/blob/v1.6.0/docs/research.md) · [Acceptance checklist and results](https://github.com/peterwangze/margin-editor/blob/main/docs/acceptance.md) · [Earlier packages](https://github.com/peterwangze/margin-editor/releases/tag/v1.5.0)
