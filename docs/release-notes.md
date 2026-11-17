Margin 1.10.0 makes everyday editing easier and fixes update checks and downloads on networks that use a system proxy.

- **Find and replace** shows the active scope beside the search controls. If a selection becomes invalid, replacements pause until you choose a scope again.
- **Document tabs** show folder names when files share a name. Open the list beside the tabs to filter by filename or path and spot unsaved edits.
- **Narrow windows** keep New, Open, Save, Find, and Replace labels visible. The active tab stays in view when you open the sidebar or resize the window.
- **File encoding** offers reopening and converting from the same status bar control. A file opened read-only after a decoding error gives you a direct way to reopen it with another encoding.
- **Updates** use the system proxy for GitHub checks and downloads. If a package transfer is interrupted, Margin can resume it and verifies the complete file with SHA-256 before installation.

Margin 1.10.0 改进了日常文本编辑体验，并修复了使用系统代理时检查和下载更新的问题。

- **查找与替换**直接显示范围。选区失效时暂停替换，重新指定范围后才能继续。
- **文档标签**为同名文件显示可区分的目录。标签旁的文档列表支持按文件名或路径筛选，并标出未保存的修改。
- **窄窗**保留新建、打开、保存、查找和替换的文字标签。打开侧栏或缩放窗口时，活动标签会保持可见。
- **文件编码**可从状态栏选择重新打开或转换。解码失败时，只读提示提供重新选择编码的入口。
- **软件更新**通过系统代理检查并下载 GitHub 更新。安装包传输中断时可续传，整包通过 SHA-256 校验后才可安装。

If your current version cannot connect to GitHub from inside the app, download the matching offline package below using your browser. Otherwise, use **Help → Check for updates → Download update → Install and restart**. In-app installation restores open files, unsaved drafts, and settings.

如果当前版本在应用内连不上 GitHub，请通过浏览器下载下方对应的离线包。应用内可连接时，依次选择「帮助 → 检查更新 → 下载更新 → 安装并重启」。通过应用内安装会恢复打开的文件、未保存草稿和设置。

## Offline downloads / 离线安装包

| Platform | Intel / AMD 64-bit | ARM64 |
| --- | --- | --- |
| Windows | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v1.10.0/Margin-1.10.0-win-x64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v1.10.0/Margin-1.10.0-win-x64-portable.exe) | [Installer](https://github.com/peterwangze/margin-editor/releases/download/v1.10.0/Margin-1.10.0-win-arm64-setup.exe) · [Portable EXE](https://github.com/peterwangze/margin-editor/releases/download/v1.10.0/Margin-1.10.0-win-arm64-portable.exe) |
| macOS | [DMG](https://github.com/peterwangze/margin-editor/releases/download/v1.10.0/Margin-1.10.0-mac-x64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v1.10.0/Margin-1.10.0-mac-x64.zip) | [Apple Silicon DMG](https://github.com/peterwangze/margin-editor/releases/download/v1.10.0/Margin-1.10.0-mac-arm64.dmg) · [ZIP](https://github.com/peterwangze/margin-editor/releases/download/v1.10.0/Margin-1.10.0-mac-arm64.zip) |
| Linux | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v1.10.0/Margin-1.10.0-linux-x86_64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v1.10.0/Margin-1.10.0-linux-amd64.deb) | [AppImage](https://github.com/peterwangze/margin-editor/releases/download/v1.10.0/Margin-1.10.0-linux-arm64.AppImage) · [DEB](https://github.com/peterwangze/margin-editor/releases/download/v1.10.0/Margin-1.10.0-linux-arm64.deb) |

[SHA-256 checksums / SHA-256 校验清单](https://github.com/peterwangze/margin-editor/releases/download/v1.10.0/SHA256SUMS.txt) · [Acceptance screenshots and results / 验收截图与结果](https://github.com/peterwangze/margin-editor/releases/download/v1.10.0/ACCEPTANCE.zip)

Choose the package for your processor. The packages include the runtime and local assets, and `SHA256SUMS.txt` covers every binary. Linux requires the host's desktop libraries. On Linux without FUSE, run the AppImage with `--appimage-extract-and-run`.

请按处理器架构选择下载包。离线包内含运行时和本地资源，`SHA256SUMS.txt` 提供各程序包的校验值。Linux 依赖系统桌面库。未安装 FUSE 时，可用 `--appimage-extract-and-run` 启动 AppImage。

Windows packages are unsigned. macOS packages use ad hoc signatures and ship without notarization. Verify the SHA-256 before opening. Your OS or organization may require approval to launch. Notepad++ native Windows plugins and original macro files require Notepad++.

Windows 包为未签名构建，macOS 包采用临时签名且未经公证。请在打开前核对 SHA-256。系统或组织的安全策略可能要求授权才能启动。Notepad++ 原生 Windows 插件和原版宏文件需要在 Notepad++ 中使用。

[Product research and scope / 产品范围](https://github.com/peterwangze/margin-editor/blob/v1.10.0/docs/research.md) · [Acceptance checklist / 验收清单](https://github.com/peterwangze/margin-editor/blob/main/docs/acceptance.md) · [Earlier 1.9.0 packages / 1.9.0 离线包](https://github.com/peterwangze/margin-editor/releases/tag/v1.9.0)
