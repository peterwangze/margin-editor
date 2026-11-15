## Offline downloads / 离线安装包

| Platform | Intel / AMD 64-bit | ARM64 |
| --- | --- | --- |
| Windows | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v1.4.0/Margin-1.4.0-win-x64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v1.4.0/Margin-1.4.0-win-x64-portable.exe) | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v1.4.0/Margin-1.4.0-win-arm64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v1.4.0/Margin-1.4.0-win-arm64-portable.exe) |
| macOS | [DMG](https://github.com/peterwangze/margin-editor/releases/download/v1.4.0/Margin-1.4.0-mac-x64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v1.4.0/Margin-1.4.0-mac-x64.zip) | [Apple Silicon DMG](https://github.com/peterwangze/margin-editor/releases/download/v1.4.0/Margin-1.4.0-mac-arm64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v1.4.0/Margin-1.4.0-mac-arm64.zip) |
| Linux | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v1.4.0/Margin-1.4.0-linux-x86_64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v1.4.0/Margin-1.4.0-linux-amd64.deb) | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v1.4.0/Margin-1.4.0-linux-arm64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v1.4.0/Margin-1.4.0-linux-arm64.deb) |

[SHA-256 checksums](https://github.com/peterwangze/margin-editor/releases/download/v1.4.0/SHA256SUMS.txt) · [Platform acceptance screenshots and results](https://github.com/peterwangze/margin-editor/releases/download/v1.4.0/ACCEPTANCE.zip)

Margin 1.4.0 adds Italian, Portuguese, and Russian, bringing the interface to 11 languages. Margin follows the first supported language in your system preferences and uses English when none match. Choose a language under **Settings → Preferences → Interface language** to switch immediately. The choice is remembered after restart. The Portuguese interface uses Brazilian Portuguese and is selected for both pt-BR and pt-PT. Cyrillic interface and editor fonts are included in the offline packages.

Margin 1.4.0 新增意大利语、葡萄牙语和俄语，共支持 11 种界面语言。默认跟随系统，可在 **设置 → 首选项 → 界面语言** 即时切换，重启后保留选择。

- Italiano **Impostazioni → Preferenze → Lingua dell’interfaccia**
- Português **Configurações → Preferências → Idioma da interface**
- Русский **Настройки → Параметры → Язык интерфейса**

Choose the package for your processor. The packages carry the runtime and local assets; `SHA256SUMS.txt` covers every binary. Linux requires the host's desktop libraries. On Linux without FUSE, run the AppImage with `--appimage-extract-and-run`.

Windows builds lack a publisher signature, and macOS builds are ad hoc signed without notarization. Verify the SHA-256 before opening; your OS or organization may require approval to launch. Notepad++'s native Windows plugins and original macro files are outside this release's compatibility.

[Product research and scope](https://github.com/peterwangze/margin-editor/blob/v1.4.0/docs/research.md) · [Acceptance checklist and results](https://github.com/peterwangze/margin-editor/blob/main/docs/acceptance.md)
