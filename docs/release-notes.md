## Offline downloads / 离线安装包

| Platform | Intel / AMD 64-bit | ARM64 |
| --- | --- | --- |
| Windows | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v1.0.0/Margin-1.0.0-win-x64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v1.0.0/Margin-1.0.0-win-x64-portable.exe) | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v1.0.0/Margin-1.0.0-win-arm64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v1.0.0/Margin-1.0.0-win-arm64-portable.exe) |
| macOS | [DMG](https://github.com/peterwangze/margin-editor/releases/download/v1.0.0/Margin-1.0.0-mac-x64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v1.0.0/Margin-1.0.0-mac-x64.zip) | [Apple Silicon DMG](https://github.com/peterwangze/margin-editor/releases/download/v1.0.0/Margin-1.0.0-mac-arm64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v1.0.0/Margin-1.0.0-mac-arm64.zip) |
| Linux | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v1.0.0/Margin-1.0.0-linux-x86_64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v1.0.0/Margin-1.0.0-linux-amd64.deb) | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v1.0.0/Margin-1.0.0-linux-arm64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v1.0.0/Margin-1.0.0-linux-arm64.deb) |

[SHA-256 checksums](https://github.com/peterwangze/margin-editor/releases/download/v1.0.0/SHA256SUMS.txt)

Margin 1.0.0 is an offline editor for notes, lists, logs, and everyday plain text. Start typing in a blank document, open an existing file, or drop one into the window. Menus, grouped tools, and document tabs stay in view.

- **Clean up pasted text with a preview.** Choose **Edit → Inspect & clean text** or click Length in the status bar. Count words and characters, identify no-break and zero-width spaces, and apply only the cleanup options you select. One Undo restores the original.
- **Keep your file format and edits safe.** Reopening a Unicode file preserves its BOM. Changing the encoding is a separate action. If you turn off session recovery, quitting with dirty files offers Save All, Discard Changes, or Cancel. Saving a copy cannot overwrite its source.
- **Review changes across files.** Find literal text, escapes, or Boost regular expressions, preview folder replacements, and apply selected files only. Margin checks whether those files changed on disk before writing.
- **Work on large logs.** Find a match across pages in Normal or Extended mode, jump to it, and save the loaded page without rewriting other bytes in supported encodings.

Choose the package for your processor. The packages carry the runtime and local assets; `SHA256SUMS.txt` covers every binary. Linux requires the host's desktop libraries. On Linux without FUSE, run the AppImage with `--appimage-extract-and-run`.

Windows builds lack a publisher signature, and macOS builds are ad hoc signed without notarization. Verify the SHA-256 before opening; your OS or organization may require approval to launch. Notepad++'s native Windows plugins and original macro files are outside this release's compatibility.

[Product research and scope](https://github.com/peterwangze/margin-editor/blob/v1.0.0/docs/research.md) · [Acceptance checklist and results](https://github.com/peterwangze/margin-editor/blob/main/docs/acceptance.md)
