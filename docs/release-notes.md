## Offline downloads / 离线安装包

| Platform | Intel / AMD 64-bit | ARM64 |
| --- | --- | --- |
| Windows | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v1.3.0/Margin-1.3.0-win-x64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v1.3.0/Margin-1.3.0-win-x64-portable.exe) | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v1.3.0/Margin-1.3.0-win-arm64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v1.3.0/Margin-1.3.0-win-arm64-portable.exe) |
| macOS | [DMG](https://github.com/peterwangze/margin-editor/releases/download/v1.3.0/Margin-1.3.0-mac-x64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v1.3.0/Margin-1.3.0-mac-x64.zip) | [Apple Silicon DMG](https://github.com/peterwangze/margin-editor/releases/download/v1.3.0/Margin-1.3.0-mac-arm64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v1.3.0/Margin-1.3.0-mac-arm64.zip) |
| Linux | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v1.3.0/Margin-1.3.0-linux-x86_64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v1.3.0/Margin-1.3.0-linux-amd64.deb) | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v1.3.0/Margin-1.3.0-linux-arm64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v1.3.0/Margin-1.3.0-linux-arm64.deb) |

[SHA-256 checksums](https://github.com/peterwangze/margin-editor/releases/download/v1.3.0/SHA256SUMS.txt) · [Platform acceptance screenshots and results](https://github.com/peterwangze/margin-editor/releases/download/v1.3.0/ACCEPTANCE.zip)

Margin 1.3.0 adds French, German, and Spanish, bringing the interface to eight languages. Margin follows the first supported language in your system preferences and uses English when none match. Choose a language under **Settings → Preferences → Interface language** to switch immediately. The choice is remembered after restart. All interface translations and fonts ship with the offline packages.

Margin 1.3.0 新增法语、德语和西班牙语，共支持八种界面语言。默认跟随系统，可通过 **设置 → 首选项 → 界面语言** 即时切换，重启后保留选择。

- Français **Paramètres → Préférences → Langue de l’interface**
- Deutsch **Einstellungen → Einstellungen → Oberflächensprache**
- Español **Configuración → Preferencias → Idioma de la interfaz**

Choose the package for your processor. The packages carry the runtime and local assets; `SHA256SUMS.txt` covers every binary. Linux requires the host's desktop libraries. On Linux without FUSE, run the AppImage with `--appimage-extract-and-run`.

Windows builds lack a publisher signature, and macOS builds are ad hoc signed without notarization. Verify the SHA-256 before opening; your OS or organization may require approval to launch. Notepad++'s native Windows plugins and original macro files are outside this release's compatibility.

[Product research and scope](https://github.com/peterwangze/margin-editor/blob/v1.3.0/docs/research.md) · [Acceptance checklist and results](https://github.com/peterwangze/margin-editor/blob/main/docs/acceptance.md)
