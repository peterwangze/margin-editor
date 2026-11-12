<p align="center"><img src="assets/margin.png" width="78" alt="Margin app icon"></p>

# Margin

**A desktop editor for the text work you do every day.**

Open a log, change a config, or clean up a whole folder of files. Margin puts the familiar menu bar and tabs up front, and keeps encoding, line endings, and unsaved changes visible while you work. Use it offline on Windows, macOS, or Linux.

[Download Margin](https://github.com/peterwangze/margin-editor/releases) · [Design and architecture](docs/architecture.md) · [Release acceptance checklist](docs/acceptance.md)

![Margin's Ink workbench with a folder sidebar, tabs, syntax highlighting, and an interactive status bar](docs/screenshots/workbench.png)

## From a quick edit to a folder-wide change

- **Start where you left off.** Open local files or folders, drop them into the window, or use the command line. Unsaved documents return with your session. Switch between Ink and Paper, split the editor, or clone one document into two views.
- **Review replacements before writing.** Find literal text, extended escapes, or regex captures. Filter folder searches by glob and depth, review before-and-after results, and choose which files to update. Margin checks that files still match the preview before applying it.
- **Keep control of your files.** Reopen with a different encoding, convert on save, or pick an EOL format from the status bar. When a file changes on disk, compare the two versions and choose how to proceed. Optional backup copies preserve the previous bytes.
- **Turn repetitive edits into commands.** Use rectangular selections, multiple cursors, bookmarks, line transformations, and replayable edit macros. Open the command palette to find JSON formatting, Markdown preview, encoding utilities, and local tools.

![In-document Find and Replace with a highlighted match and accessible controls](docs/screenshots/find.png)

## Get Margin

Download a standalone package from [GitHub Releases](https://github.com/peterwangze/margin-editor/releases). Choose `x64` for a 64-bit Intel or AMD system, or `arm64` for Apple Silicon and other ARM64 systems.

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

Margin 0.9.0 is an early release. The [Notepad++ comparison](docs/research.md) and [acceptance checklist](docs/acceptance.md) track migration coverage, including open work for Win32 plugins, full UDL import, Boost regex syntax, and large files beyond the 48 MiB editing limit. The [test and packaging workflow](.github/workflows/build.yml) records each build's platform coverage.

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
