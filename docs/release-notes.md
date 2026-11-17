Margin 1.9.0 highlights the two keywords that open and close a code block when you place the cursor on either one. In nested blocks, Margin highlights the pair at the cursor’s nesting level. If the editor can confirm the other keyword is missing, it marks the current keyword on its own. Matching skips keywords inside comments and strings.

在 Margin 1.9.0 中，把光标移到代码块的起始或结束关键字上，两端会同时高亮。嵌套时只高亮光标所在层级的配对。编辑器可以确认另一端缺失时，会单独标记当前关键字。匹配时会跳过注释和字符串里的关键字。

| Syntax mode / 语法模式 | Example pairs / 配对示例 |
| --- | --- |
| Verilog, SystemVerilog | `begin` / `end`, `module` / `endmodule`, `case` / `endcase` |
| VHDL | `if` / `end if`, `process` / `end process` |
| Lua | `function` / `end`, `repeat` / `until` |
| Shell | `if` / `fi`, `do` / `done` |
| Pascal | `begin` / `end`, `repeat` / `until` |

To update from 1.8.0, open **Help → Check for updates**, choose **Download update**, then select **Install and restart** after SHA-256 verification. Margin downloads the package for your system and architecture and restores your documents, unsaved drafts, and settings on restart. On macOS and for Linux AppImage, update from a writable location. Updating an installed DEB may require administrator authorization.

从 1.8.0 升级时，打开「帮助 → 检查更新」，选择「下载更新」，通过 SHA-256 校验后点击「安装并重启」。Margin 会下载适合当前系统和架构的包，并在重启后恢复打开的文档、未保存草稿和设置。macOS 应用和 Linux AppImage 需要位于可写目录，更新已安装的 DEB 可能需要管理员授权。

## Offline downloads / 离线安装包

| Platform | Intel / AMD 64-bit | ARM64 |
| --- | --- | --- |
| Windows | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v1.9.0/Margin-1.9.0-win-x64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v1.9.0/Margin-1.9.0-win-x64-portable.exe) | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v1.9.0/Margin-1.9.0-win-arm64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v1.9.0/Margin-1.9.0-win-arm64-portable.exe) |
| macOS | [DMG](https://github.com/peterwangze/margin-editor/releases/download/v1.9.0/Margin-1.9.0-mac-x64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v1.9.0/Margin-1.9.0-mac-x64.zip) | [Apple Silicon DMG](https://github.com/peterwangze/margin-editor/releases/download/v1.9.0/Margin-1.9.0-mac-arm64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v1.9.0/Margin-1.9.0-mac-arm64.zip) |
| Linux | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v1.9.0/Margin-1.9.0-linux-x86_64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v1.9.0/Margin-1.9.0-linux-amd64.deb) | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v1.9.0/Margin-1.9.0-linux-arm64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v1.9.0/Margin-1.9.0-linux-arm64.deb) |

[SHA-256 checksums / SHA-256 校验清单](https://github.com/peterwangze/margin-editor/releases/download/v1.9.0/SHA256SUMS.txt) · [Acceptance screenshots and results / 验收截图与结果](https://github.com/peterwangze/margin-editor/releases/download/v1.9.0/ACCEPTANCE.zip)

Choose the package for your processor. The packages include the runtime and local assets, and `SHA256SUMS.txt` covers every binary. Linux requires the host's desktop libraries. On Linux without FUSE, run the AppImage with `--appimage-extract-and-run`.

请按处理器架构选择下载包。离线包内含运行时和本地资源，`SHA256SUMS.txt` 提供各程序包的校验值。Linux 依赖系统桌面库。未安装 FUSE 时，可用 `--appimage-extract-and-run` 启动 AppImage。

Windows packages are unsigned. macOS packages use ad hoc signatures and ship without notarization. Verify the SHA-256 before opening. Your OS or organization may require approval to launch. Notepad++ native Windows plugins and original macro files require Notepad++.

Windows 包为未签名构建，macOS 包采用临时签名且未经公证。请在打开前核对 SHA-256。系统或组织的安全策略可能要求授权才能启动。Notepad++ 原生 Windows 插件和原版宏文件需要在 Notepad++ 中使用。

[Product research and scope / 产品范围](https://github.com/peterwangze/margin-editor/blob/v1.9.0/docs/research.md) · [Acceptance checklist / 验收清单](https://github.com/peterwangze/margin-editor/blob/main/docs/acceptance.md) · [Earlier 1.8.0 packages / 1.8.0 离线包](https://github.com/peterwangze/margin-editor/releases/tag/v1.8.0)
