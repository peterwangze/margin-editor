Margin 1.8.0 detects syntax as you type or paste into a document without a recognized filename. It highlights formats with clear patterns such as Verilog, Python, and JSON. Ambiguous content stays in **Plain Text**. Use the syntax control in the status bar to choose a mode or switch back to **Automatic**. Both light and dark themes use blue semibold keywords across supported syntax modes, including Verilog, SystemVerilog, Python, and JavaScript. User-defined languages use the styles specified in their definitions.

对没有可识别文件名的文档，Margin 1.8.0 会在输入或粘贴时识别 Verilog、Python、JSON 等有明确特征的语法。难以判断的内容保持「纯文本」。点击状态栏的语法名称可手动选择，也可以切回「自动识别」。浅色和深色主题均为受支持的语法模式使用蓝色半粗体关键字，包括 Verilog、SystemVerilog、Python 和 JavaScript。用户定义的语言采用其定义中指定的样式。

To update from 1.7.0, open **Help → Check for updates**, choose **Download update**, then select **Install and restart** after SHA-256 verification. Margin downloads the package for your system and architecture and restores your documents, unsaved drafts, and settings on restart. On macOS and for Linux AppImage, update from a writable location. Updating an installed DEB may require administrator authorization.

从 1.7.0 升级时，打开「帮助 → 检查更新」，选择「下载更新」，通过 SHA-256 校验后点击「安装并重启」。Margin 会下载适合当前系统和架构的包，并在重启后恢复打开的文档、未保存草稿和设置。macOS 应用和 Linux AppImage 需要位于可写目录，更新已安装的 DEB 可能需要管理员授权。

## Offline downloads / 离线安装包

| Platform | Intel / AMD 64-bit | ARM64 |
| --- | --- | --- |
| Windows | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v1.8.0/Margin-1.8.0-win-x64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v1.8.0/Margin-1.8.0-win-x64-portable.exe) | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v1.8.0/Margin-1.8.0-win-arm64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v1.8.0/Margin-1.8.0-win-arm64-portable.exe) |
| macOS | [DMG](https://github.com/peterwangze/margin-editor/releases/download/v1.8.0/Margin-1.8.0-mac-x64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v1.8.0/Margin-1.8.0-mac-x64.zip) | [Apple Silicon DMG](https://github.com/peterwangze/margin-editor/releases/download/v1.8.0/Margin-1.8.0-mac-arm64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v1.8.0/Margin-1.8.0-mac-arm64.zip) |
| Linux | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v1.8.0/Margin-1.8.0-linux-x86_64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v1.8.0/Margin-1.8.0-linux-amd64.deb) | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v1.8.0/Margin-1.8.0-linux-arm64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v1.8.0/Margin-1.8.0-linux-arm64.deb) |

[SHA-256 checksums](https://github.com/peterwangze/margin-editor/releases/download/v1.8.0/SHA256SUMS.txt) · [Platform acceptance screenshots and results](https://github.com/peterwangze/margin-editor/releases/download/v1.8.0/ACCEPTANCE.zip)

Choose the package for your processor. The packages carry the runtime and local assets; `SHA256SUMS.txt` covers every binary. Linux requires the host's desktop libraries. On Linux without FUSE, run the AppImage with `--appimage-extract-and-run`.

Windows builds lack a publisher signature, and macOS builds are ad hoc signed without notarization. Verify the SHA-256 before opening; your OS or organization may require approval to launch. Notepad++'s native Windows plugins and original macro files are outside this release's compatibility.

[Product research and scope](https://github.com/peterwangze/margin-editor/blob/v1.8.0/docs/research.md) · [Acceptance checklist and results](https://github.com/peterwangze/margin-editor/blob/main/docs/acceptance.md) · [Earlier 1.7.0 packages](https://github.com/peterwangze/margin-editor/releases/tag/v1.7.0)
