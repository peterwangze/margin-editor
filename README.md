<p align="center"><img src="assets/margin.png" width="78" alt="Margin app icon"></p>

# Margin

**A desktop editor for the text work you do every day.**

Open a log, change a config, or clean up a whole folder of files. Margin puts the familiar menu bar and tabs up front, and keeps encoding, line endings, and unsaved changes visible while you work. Use it offline on Windows, macOS, or Linux.

[All releases](https://github.com/peterwangze/margin-editor/releases) · [Design and architecture](docs/architecture.md) · [Release acceptance checklist](docs/acceptance.md)

## Download Margin 0.9.1

Choose the offline package for your operating system and processor. This version is a public prerelease.

| Platform | Intel / AMD 64-bit | ARM64 |
| --- | --- | --- |
| Windows | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-win-x64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-win-x64-portable.exe) | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-win-arm64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-win-arm64-portable.exe) |
| macOS | [DMG](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-mac-x64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-mac-x64.zip) | [Apple Silicon DMG](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-mac-arm64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-mac-arm64.zip) |
| Linux | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-linux-x86_64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-linux-amd64.deb) | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-linux-arm64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/Margin-0.9.1-linux-arm64.deb) |

[Release notes and assets](https://github.com/peterwangze/margin-editor/releases/tag/v0.9.1) · [SHA-256 checksums](https://github.com/peterwangze/margin-editor/releases/download/v0.9.1/SHA256SUMS.txt)

![Margin's Paper theme with a grouped toolbar, document tabs, full-width editor, and interactive status bar](docs/screenshots/workbench.png)

## From a quick edit to a folder-wide change

- **Open straight into a document.** Start typing in a blank file, drop local files into the window, or use the familiar toolbar. The folder tree opens on demand. Split or clone a document when you need another view.
- **Bring your Notepad++ setup.** Import sessions with bookmarks and recoverable backups, common preferences, supported menu shortcuts, and user languages with keyword colors, delimiters, and folds.
- **Review replacements before writing.** Find literal text, extended escapes, or regex captures. Filter folder searches by glob and depth, review before-and-after results, and choose which files to update. Margin checks that files still match the preview before applying it.
- **Keep control of your files.** Reopen with a different encoding, convert on save, or pick an EOL format from the status bar. When a file changes on disk, compare the two versions and choose how to proceed. Optional backup copies preserve the previous bytes.
- **Work on a large log one page at a time.** Search across all pages and jump to a match. Edit the page and save while preserving the untouched bytes in supported encodings.
- **Turn repetitive edits into commands.** Use rectangular selections, multiple cursors, bookmarks, line transformations, and replayable edit macros. Open the command palette to find JSON formatting, Markdown preview, encoding utilities, and local tools.

![In-document Find and Replace with a highlighted match and accessible controls](docs/screenshots/find.png)

## Install offline

| Platform | Offline packages | How to start |
| --- | --- | --- |
| Windows | NSIS `setup.exe`, portable `.exe` | Run Setup or launch the portable executable. |
| macOS | `.dmg`, `.zip` | Copy `Margin.app` to Applications. Use the package matching your Mac's processor. |
| Linux | `.AppImage`, `.deb` | Make the AppImage executable, or install the DEB with your local package manager. AppImage requires FUSE or can be run with `--appimage-extract-and-run`. |

Packages bundle Electron and the UI assets. Linux still uses the system's desktop libraries. Builds have no publisher certificate or Apple notarization. Verify the download with the `SHA256SUMS.txt` published with the release.

| Action | Windows / Linux | macOS |
| --- | --- | --- |
| Command palette | Ctrl+Shift+P | ⌘⇧P |
| Quick open | Ctrl+P | ⌘P |
| Find / Replace | Ctrl+F / Ctrl+H | ⌘F / ⌘H |
| Find in Files | Ctrl+Shift+F | ⌘⇧F |
| Go to line | Ctrl+G | ⌘G |
| Split editor | Ctrl+\ | ⌘\ |

## Compatibility

The [Notepad++ comparison](docs/research.md) and [acceptance checklist](docs/acceptance.md) track coverage and remaining work, including native Win32 plugins, full UDL behavior, Boost regex, and whole-file regex replace in large documents. The [test and packaging workflow](.github/workflows/build.yml) records each build's platform coverage.

## Develop locally

```sh
npm ci
npm run build
npm start
npm test
npx playwright install chromium
npm run test:ui
npm run test:desktop
```

Build offline packages on the target operating system with `npm run package`. On a headless Linux runner, run the desktop tests under `xvfb-run -a`.

[MIT License](LICENSE)
