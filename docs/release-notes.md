## Offline downloads / 离线安装包

| Platform | Intel / AMD 64-bit | ARM64 |
| --- | --- | --- |
| Windows | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v1.2.0/Margin-1.2.0-win-x64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v1.2.0/Margin-1.2.0-win-x64-portable.exe) | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v1.2.0/Margin-1.2.0-win-arm64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v1.2.0/Margin-1.2.0-win-arm64-portable.exe) |
| macOS | [DMG](https://github.com/peterwangze/margin-editor/releases/download/v1.2.0/Margin-1.2.0-mac-x64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v1.2.0/Margin-1.2.0-mac-x64.zip) | [Apple Silicon DMG](https://github.com/peterwangze/margin-editor/releases/download/v1.2.0/Margin-1.2.0-mac-arm64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v1.2.0/Margin-1.2.0-mac-arm64.zip) |
| Linux | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v1.2.0/Margin-1.2.0-linux-x86_64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v1.2.0/Margin-1.2.0-linux-amd64.deb) | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v1.2.0/Margin-1.2.0-linux-arm64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v1.2.0/Margin-1.2.0-linux-arm64.deb) |

[SHA-256 checksums](https://github.com/peterwangze/margin-editor/releases/download/v1.2.0/SHA256SUMS.txt) · [Platform acceptance screenshots and results](https://github.com/peterwangze/margin-editor/releases/download/v1.2.0/ACCEPTANCE.zip)

Margin 1.2.0 adds Traditional Chinese, Japanese, and Korean alongside English and Simplified Chinese. It follows the operating system's language preferences by default and falls back to English. Choose a language under **Settings → Preferences → Interface language**. Changes take effect immediately and the choice is remembered after a restart. Fonts are included in the offline packages.

Margin 1.2.0 新增繁體中文、日本語和한국어界面。可在界面语言设置里即时切换，重启后保留选择。

- 繁體中文 **設定 → 偏好設定 → 介面語言**
- 日本語 **設定 → 環境設定 → 表示言語**
- 한국어 **설정 → 환경 설정 → 인터페이스 언어**

Choose the package for your processor. The packages carry the runtime and local assets; `SHA256SUMS.txt` covers every binary. Linux requires the host's desktop libraries. On Linux without FUSE, run the AppImage with `--appimage-extract-and-run`.

Windows builds lack a publisher signature, and macOS builds are ad hoc signed without notarization. Verify the SHA-256 before opening; your OS or organization may require approval to launch. Notepad++'s native Windows plugins and original macro files are outside this release's compatibility.

[Product research and scope](https://github.com/peterwangze/margin-editor/blob/v1.2.0/docs/research.md) · [Acceptance checklist and results](https://github.com/peterwangze/margin-editor/blob/main/docs/acceptance.md)
