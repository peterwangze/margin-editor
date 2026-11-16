## Offline downloads / 离线安装包

| Platform | Intel / AMD 64-bit | ARM64 |
| --- | --- | --- |
| Windows | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v1.5.0/Margin-1.5.0-win-x64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v1.5.0/Margin-1.5.0-win-x64-portable.exe) | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v1.5.0/Margin-1.5.0-win-arm64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v1.5.0/Margin-1.5.0-win-arm64-portable.exe) |
| macOS | [DMG](https://github.com/peterwangze/margin-editor/releases/download/v1.5.0/Margin-1.5.0-mac-x64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v1.5.0/Margin-1.5.0-mac-x64.zip) | [Apple Silicon DMG](https://github.com/peterwangze/margin-editor/releases/download/v1.5.0/Margin-1.5.0-mac-arm64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v1.5.0/Margin-1.5.0-mac-arm64.zip) |
| Linux | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v1.5.0/Margin-1.5.0-linux-x86_64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v1.5.0/Margin-1.5.0-linux-amd64.deb) | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v1.5.0/Margin-1.5.0-linux-arm64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v1.5.0/Margin-1.5.0-linux-arm64.deb) |

[SHA-256 checksums](https://github.com/peterwangze/margin-editor/releases/download/v1.5.0/SHA256SUMS.txt) · [Platform acceptance screenshots and results](https://github.com/peterwangze/margin-editor/releases/download/v1.5.0/ACCEPTANCE.zip)

Margin 1.5.0 adds Arabic, Hindi, and Indonesian, bringing the interface to 14 languages. Margin follows the first supported language in your system preferences and uses English when none match. Choose a language under **Settings → Preferences → Interface language** to switch immediately. The app remembers your choice after restart.

Arabic menus and panels read from right to left. Set the document direction separately under **Settings → Preferences → Right-to-left text**. The offline packages include Noto Sans Arabic and Noto Sans Devanagari for the interface and editor.

Margin 1.5.0 新增阿拉伯语、印地语和印度尼西亚语，共支持 14 种界面语言。默认跟随系统，可在 **设置 → 首选项 → 界面语言** 即时切换，重启后保留选择。阿拉伯语界面从右到左排列，文档方向可以单独设置。离线包内置阿拉伯文和天城文字体。

- العربية · **الإعدادات / التفضيلات… / لغة الواجهة**
- हिन्दी · **सेटिंग्स → प्राथमिकताएँ… → इंटरफ़ेस की भाषा**
- Bahasa Indonesia · **Pengaturan → Preferensi… → Bahasa antarmuka**

Choose the package for your processor. The packages carry the runtime and local assets; `SHA256SUMS.txt` covers every binary. Linux requires the host's desktop libraries. On Linux without FUSE, run the AppImage with `--appimage-extract-and-run`.

Windows builds lack a publisher signature, and macOS builds are ad hoc signed without notarization. Verify the SHA-256 before opening; your OS or organization may require approval to launch. Notepad++'s native Windows plugins and original macro files are outside this release's compatibility.

[Product research and scope](https://github.com/peterwangze/margin-editor/blob/v1.5.0/docs/research.md) · [Acceptance checklist and results](https://github.com/peterwangze/margin-editor/blob/main/docs/acceptance.md) · [Earlier packages](https://github.com/peterwangze/margin-editor/releases/tag/v1.4.0)
