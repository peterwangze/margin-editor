Margin 1.7.0 can install updates and restart from the app. Open **Help → Check for updates**, choose **Download update**, then select **Install and restart** after SHA-256 verification. Margin reopens your documents and restores unsaved drafts and settings. If session recovery is off, Margin restores the session once for the update.

The update uses the package for your operating system and architecture. Margin saves the verified package to Downloads and can show it in its folder. On macOS, run Margin from a writable location to update the app. On Linux, updating an installed DEB may ask for administrator authorization, and updating an AppImage requires a writable location. Checking and downloading updates requires an Internet connection. Editing works offline.

Margin 1.7.0 支持在应用内安装更新并重启。打开「帮助 → 检查更新」，选择「下载更新」，通过 SHA-256 校验后点击「安装并重启」。重启后会恢复打开的文档、未保存草稿和设置。关闭会话恢复时，Margin 也会为这次更新恢复一次会话。检查和下载更新需要联网，编辑可离线使用。

Margin supports 14 interface languages, including Arabic with right-to-left menus, Hindi, and Indonesian. Choose your language under **Settings → Preferences → Interface language**.

## Offline downloads / 离线安装包

| Platform | Intel / AMD 64-bit | ARM64 |
| --- | --- | --- |
| Windows | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v1.7.0/Margin-1.7.0-win-x64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v1.7.0/Margin-1.7.0-win-x64-portable.exe) | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v1.7.0/Margin-1.7.0-win-arm64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v1.7.0/Margin-1.7.0-win-arm64-portable.exe) |
| macOS | [DMG](https://github.com/peterwangze/margin-editor/releases/download/v1.7.0/Margin-1.7.0-mac-x64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v1.7.0/Margin-1.7.0-mac-x64.zip) | [Apple Silicon DMG](https://github.com/peterwangze/margin-editor/releases/download/v1.7.0/Margin-1.7.0-mac-arm64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v1.7.0/Margin-1.7.0-mac-arm64.zip) |
| Linux | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v1.7.0/Margin-1.7.0-linux-x86_64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v1.7.0/Margin-1.7.0-linux-amd64.deb) | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v1.7.0/Margin-1.7.0-linux-arm64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v1.7.0/Margin-1.7.0-linux-arm64.deb) |

[SHA-256 checksums](https://github.com/peterwangze/margin-editor/releases/download/v1.7.0/SHA256SUMS.txt) · [Platform acceptance screenshots and results](https://github.com/peterwangze/margin-editor/releases/download/v1.7.0/ACCEPTANCE.zip)

Choose the package for your processor. The packages carry the runtime and local assets; `SHA256SUMS.txt` covers every binary. Linux requires the host's desktop libraries. On Linux without FUSE, run the AppImage with `--appimage-extract-and-run`.

Windows builds lack a publisher signature, and macOS builds are ad hoc signed without notarization. Verify the SHA-256 before opening; your OS or organization may require approval to launch. Notepad++'s native Windows plugins and original macro files are outside this release's compatibility.

[Product research and scope](https://github.com/peterwangze/margin-editor/blob/v1.7.0/docs/research.md) · [Acceptance checklist and results](https://github.com/peterwangze/margin-editor/blob/main/docs/acceptance.md) · [Earlier packages](https://github.com/peterwangze/margin-editor/releases/tag/v1.6.0)
