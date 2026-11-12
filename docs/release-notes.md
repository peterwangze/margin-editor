Margin 0.9.0 brings a local text workbench to Windows, macOS, and Linux. Open files into the Ink or Paper interface, split or clone documents, and pick up unsaved work from the previous session.

- Find and replace within a document, or review folder-wide replacements before applying selected files.
- Inspect encoding and line endings from the status bar. Compare external changes and keep optional backups on save.
- Use the command palette for bookmarks, column editing, macros, JSON formatting, Markdown preview, and text conversions.
- Page through large logs in read-only mode. Regular text editing supports files up to 48 MiB.

Choose the package for your processor. Windows packages are NSIS setup and portable EXE, macOS packages are DMG and ZIP, and Linux packages are AppImage and DEB. `SHA256SUMS.txt` covers every binary. The packages carry the runtime and local assets. Linux requires the host's desktop libraries. Windows builds lack a publisher signature, and macOS builds are ad hoc signed without notarization.

This prerelease covers common Notepad++ workflows. The [acceptance checklist](https://github.com/peterwangze/margin-editor/blob/main/docs/acceptance.md) records outstanding plugin ABI, Boost regex, UDL, platform integration, and manual validation requirements.
