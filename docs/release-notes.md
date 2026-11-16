## Offline downloads / 离线安装包

| Platform | Intel / AMD 64-bit | ARM64 |
| --- | --- | --- |
| Windows | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v1.5.1/Margin-1.5.1-win-x64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v1.5.1/Margin-1.5.1-win-x64-portable.exe) | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v1.5.1/Margin-1.5.1-win-arm64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v1.5.1/Margin-1.5.1-win-arm64-portable.exe) |
| macOS | [DMG](https://github.com/peterwangze/margin-editor/releases/download/v1.5.1/Margin-1.5.1-mac-x64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v1.5.1/Margin-1.5.1-mac-x64.zip) | [Apple Silicon DMG](https://github.com/peterwangze/margin-editor/releases/download/v1.5.1/Margin-1.5.1-mac-arm64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v1.5.1/Margin-1.5.1-mac-arm64.zip) |
| Linux | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v1.5.1/Margin-1.5.1-linux-x86_64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v1.5.1/Margin-1.5.1-linux-amd64.deb) | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v1.5.1/Margin-1.5.1-linux-arm64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v1.5.1/Margin-1.5.1-linux-arm64.deb) |

[SHA-256 checksums](https://github.com/peterwangze/margin-editor/releases/download/v1.5.1/SHA256SUMS.txt) · [Platform acceptance screenshots and results](https://github.com/peterwangze/margin-editor/releases/download/v1.5.1/ACCEPTANCE.zip)

Margin 1.5.1 shows the installed version in the title bar. Click **v1.5.1** to open **About Margin**, then choose **View latest release** to compare your version with the current release on GitHub.

Margin 1.5.1 在标题栏显示已安装版本。点击 **v1.5.1** 打开「关于 Margin」，再点击「查看最新发行版」，即可在 GitHub 上对照当前发行版。

Margin supports 14 interface languages, including Arabic with right-to-left menus, Hindi, and Indonesian. Choose your language under **Settings → Preferences → Interface language**.

Choose the package for your processor. The packages carry the runtime and local assets; `SHA256SUMS.txt` covers every binary. Linux requires the host's desktop libraries. On Linux without FUSE, run the AppImage with `--appimage-extract-and-run`.

Windows builds lack a publisher signature, and macOS builds are ad hoc signed without notarization. Verify the SHA-256 before opening; your OS or organization may require approval to launch. Notepad++'s native Windows plugins and original macro files are outside this release's compatibility.

[Product research and scope](https://github.com/peterwangze/margin-editor/blob/v1.5.1/docs/research.md) · [Acceptance checklist and results](https://github.com/peterwangze/margin-editor/blob/main/docs/acceptance.md) · [Earlier packages](https://github.com/peterwangze/margin-editor/releases/tag/v1.5.0)
