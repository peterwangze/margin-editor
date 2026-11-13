## Offline downloads / 离线安装包

| Platform | Intel / AMD 64-bit | ARM64 |
| --- | --- | --- |
| Windows | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-win-x64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-win-x64-portable.exe) | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-win-arm64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-win-arm64-portable.exe) |
| macOS | [DMG](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-mac-x64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-mac-x64.zip) | [Apple Silicon DMG](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-mac-arm64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-mac-arm64.zip) |
| Linux | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-linux-x86_64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-linux-amd64.deb) | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-linux-arm64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-linux-arm64.deb) |

[SHA-256 checksums](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/SHA256SUMS.txt)

Margin 0.9.1 opens to a document-first editor with a grouped toolbar, full-width tabs, and a bottom Find and Replace panel. Open the file tree or outline from View when you need it.

- Find and replace within a document, or review folder-wide replacements before applying selected files.
- Regular expression search and replace uses the bundled Boost.Regex 1.90 engine. It supports patterns such as `\K` and named-group replacements such as `$+{name}`.
- Inspect encoding and line endings from the status bar. Compare external changes and keep optional backups on save.
- Use the command palette for bookmarks, column editing, macros, JSON formatting, Markdown preview, and text conversions.
- Import Notepad++ XML sessions and project trees, common preferences, supported menu shortcuts, and UDLs with keyword colors, comments, operators, delimiters and folds.
- Edit large files a page at a time in supported encodings. Find text across pages in Normal or Extended mode, jump to a match, and save the page without altering the other bytes.

Choose the package for your processor. Windows packages are NSIS setup and portable EXE, macOS packages are DMG and ZIP, and Linux packages are AppImage and DEB. `SHA256SUMS.txt` covers every binary. The packages carry the runtime and local assets. Linux requires the host's desktop libraries. Windows builds lack a publisher signature, and macOS builds are ad hoc signed without notarization.

The [acceptance checklist](https://github.com/peterwangze/margin-editor/blob/main/docs/acceptance.md) records outstanding plugin ABI, regex edge cases, UDL, platform integration, and manual validation requirements.
