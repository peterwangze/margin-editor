# 纯文本编辑器调研

Margin 面向在 Windows、macOS 和 Linux 上记草稿、整理从网页或表格粘贴的文本、调整配置、检索日志、批量修改本地文件的人。启动后可以直接输入。菜单、工具栏、标签和状态栏是日常入口，目录面板按需打开。配置文件的语法高亮有助于阅读，正式版的质量由实际文本任务和文件写入结果决定。

以下对照以 2026-11-13 可查的官方手册、发行记录和原始用户报告为依据。报告指向当时遇到的具体问题，当前功能另按手册核实。这里没有用同一组硬件测试竞品的速度，也没有以问题票数估算普遍程度。Notepad++ 参照 v8.9.9.1 及手册提交 `1063c51df97e128f7860c6ea13d980eca89b4d10`。[Notepad++ 发行记录](https://github.com/notepad-plus-plus/notepad-plus-plus/releases/tag/v8.9.9.1) · [固定版本手册](https://github.com/notepad-plus-plus/npp-usermanual/tree/1063c51df97e128f7860c6ea13d980eca89b4d10/content/docs)

| 产品 | 已有能力与借鉴点 |
| --- | --- |
| Windows Notepad | 单文件入口、标签、未保存标记和会话恢复让记笔记保持低成本。微软把会话恢复与是否写入原文件分开，值得保留这一边界。[标签和未保存标记](https://blogs.windows.com/windows-insider/2023/01/19/tabs-in-notepad-begins-rolling-out-to-windows-insiders/) · [会话恢复](https://blogs.windows.com/windows-insider/2023/08/31/new-updates-for-snipping-tool-and-notepad-for-windows-insiders/) |
| Apple TextEdit | 支持纯文本，但新文档默认采用富文本。遇到乱码，可以在打开对话框为单个文档选择编码。Margin 的新文档始终是纯文本，从状态栏区分重新解码和保存转码。[新建和转换文档](https://support.apple.com/en-gb/guide/textedit/txtee6663a0e/1.20/mac/26) · [选择打开编码](https://support.apple.com/en-ca/guide/textedit/txted1028/mac) |
| Notepad++ | 菜单、工具栏和标签让列编辑、书签、编码和扩展查找易于找到。现行手册已有文件摘要和不可见字符显示，也会提示粘贴进搜索框的隐形字符。Margin 保留常用编辑入口，把字符盘点、可选清理和结果预览放到同一操作。[界面](https://github.com/notepad-plus-plus/npp-usermanual/blob/1063c51df97e128f7860c6ea13d980eca89b4d10/content/docs/user-interface.md) · [字符显示和文件摘要](https://github.com/notepad-plus-plus/npp-usermanual/blob/1063c51df97e128f7860c6ea13d980eca89b4d10/content/docs/views.md#show-symbol) · [查找](https://github.com/notepad-plus-plus/npp-usermanual/blob/1063c51df97e128f7860c6ea13d980eca89b4d10/content/docs/searching.md) |
| Kate | 提供停靠式查找、文件夹过滤、可定位的匹配和勾选替换。逐项确认已有成熟先例。Margin 的重点是把目录深度、替换前后内容和提交前磁盘复核串成一次操作。[文档查找](https://docs.kde.org/stable_kf6/en/kate/katepart/kate-part-find-replace.html) · [跨文件查找与替换](https://docs.kde.org/stable_kf6/en/kate/kate/kate-application-plugin-searchinfiles.html) |
| CotEditor | 能检查选中字符的 Unicode 属性，列出目标编码无法表示的字符，编辑时自动备份。Margin 借鉴可诊断性，在三平台提供同样的文本检查流程，并在保存时拒绝有损转码。[产品功能](https://coteditor.com/) |
| EmEditor | 大文件控制器支持按文件区段读取和编辑，给大日志的分段工作方式提供了现成参照。Margin 将大文件的范围提示与跨页查找放在同一编辑流程。[大文件支持](https://www.emeditor.com/text-editor-features/large-file-support/) |

## 从问题记录到产品验收

| 用户任务 | 现象与证据 | Margin 的发布验收目标 |
| --- | --- | --- |
| 写草稿，顺手打开另一份文件 | Notepad++ 的用户曾报告窄窗的竖排标签被裁切。Windows Notepad 把标签和未保存标记放在一起。窗口收窄后仍要能识别并切换文档。[标签报告](https://github.com/notepad-plus-plus/notepad-plus-plus/issues/18594) · [Notepad 标签](https://blogs.windows.com/windows-insider/2023/01/19/tabs-in-notepad-begins-rolling-out-to-windows-insiders/) | 空白文档取得焦点。缩小窗口后仍能看见活动标签、访问菜单和查找条，并能只用键盘完成打开、编辑和保存。 |
| 清理复制来的文本，理解字数和异常字符 | Notepad++ 的旧版报告显示，从网页复制的 U+200B 会影响后续处理。当前版本已支持显示该字符。Unicode 将用户感知的字符与实际编码单元区分开，组合音标与 emoji 尤其需要区分。[粘贴案例](https://github.com/notepad-plus-plus/notepad-plus-plus/issues/12289) · [现行字符显示](https://github.com/notepad-plus-plus/npp-usermanual/blob/1063c51df97e128f7860c6ea13d980eca89b4d10/content/docs/views.md#show-symbol) · [Unicode 文本分段](https://unicode.org/reports/tr29/) | 检查整份文件、选区或大文件当前页。统计字素和分词结果并列出不可见字符。按需选择去掉行末空格和制表符、替换不换行空格或移除 U+200B。显示变更行数和前六行的修改前后，应用后可一次撤销。 |
| 编辑旧编码文件，或只改混合换行文件中的一行 | 用户曾报告状态栏显示 LF、输入后却出现 CRLF 的情况，讨论指向外部 EditorConfig 插件及发现混合换行的问题。另一份报告讨论剪贴板的换行标准化。TextEdit 和 CotEditor 分别提供重新选择编码和检查不可转码字符的参照。[跨平台换行报告](https://github.com/notepad-plus-plus/notepad-plus-plus/issues/16639) · [混合换行粘贴](https://github.com/notepad-plus-plus/notepad-plus-plus/issues/4736) · [TextEdit 编码](https://support.apple.com/en-ca/guide/textedit/txted1028/mac) · [CotEditor 转码检查](https://coteditor.com/) | 明示编码和换行，区分按编码重新打开与转换保存。按原 Unicode 编码重新打开时保留源文件的 BOM 状态。普通修改保留未改行的换行，显式统一换行时转换整份文件。目标编码无法表达新增字符时，保留编辑和磁盘文件并显示原因。 |
| 恢复未保存草稿，避免覆盖其他应用刚写的文件 | Notepad++ 手册说明会话快照与保存时备份的作用不同。用户报告涉及写入快照时磁盘满和多实例恢复。[备份手册](https://github.com/notepad-plus-plus/npp-usermanual/blob/1063c51df97e128f7860c6ea13d980eca89b4d10/content/docs/preferences.md#backup) · [磁盘写满案例](https://github.com/notepad-plus-plus/notepad-plus-plus/issues/18267) · [多实例恢复请求](https://github.com/notepad-plus-plus/notepad-plus-plus/issues/12533) | 异常退出后读回最后一次写入完成的快照，原文档字节保持一致。关闭会话恢复时，退出提供保存全部、放弃修改和取消。保存副本要求独立目标。发现其他进程修改了源文件时，拒绝覆盖，保留编辑并提供差异查看。 |
| 只修改一批符合条件的文件 | Notepad++ 提供文件过滤和是否递归，用户另提出最大目录深度。Kate 已有勾选结果后替换。这里的风险集中在范围看错和应用前文件已变。[目录深度请求](https://github.com/notepad-plus-plus/notepad-plus-plus/issues/18544) · [Notepad++ 查找手册](https://github.com/notepad-plus-plus/npp-usermanual/blob/1063c51df97e128f7860c6ea13d980eca89b4d10/content/docs/searching.md#find-in-files-tab) · [Kate 勾选替换](https://docs.kde.org/stable_kf6/en/kate/kate/kate-application-plugin-searchinfiles.html) | 输入文件过滤和最大深度，预览修改前后，排除一个文件再提交。另开进程改动预览中的文件，再提交时应阻止过时计划。对实际写入和跳过的文件逐一核验。 |
| 在大日志里找到事件并就地改一个值 | Notepad++ 的贡献者说明其内存编辑模型的限制，手册记载可配置大文件触发关闭所有标签的自动换行。EmEditor 的分段加载说明了这一任务的可行交互。[大文件报告](https://github.com/notepad-plus-plus/notepad-plus-plus/issues/15620) · [Notepad++ 性能选项](https://github.com/notepad-plus-plus/npp-usermanual/blob/1063c51df97e128f7860c6ea13d980eca89b4d10/content/docs/preferences.md#performance) · [EmEditor 大文件支持](https://www.emeditor.com/text-editor-features/large-file-support/) | 在超过 48 MiB 的日志中搜索跨页命中，跳到目标页，编辑并保存。核对页以外的字节与原文件一致，其他文档可继续编辑。 |

## 功能范围与证据

正式版按[发行验收清单](acceptance.md)检查静态界面、键盘和可见反馈，并在 Windows、macOS、Linux 打包应用中实际打开、编辑、查找、保存和重开本地文件。研究对照说明为何选择场景，实际通过情况以相应版本的执行记录为准。

| 范围 | 用户可用的入口或能力 | 已知边界 |
| --- | --- | --- |
| 文件与编辑 | 新建、打开、拖放、标签、拆分、普通撤销、列选择和常用行操作 | 二进制数据需要专用编辑器。 |
| 查找与批改 | 普通、扩展和 Boost 正则，选区及目录查找，预览、选择文件及写入检查 | 分页大文件的全文件搜索覆盖普通和扩展模式，正则限已加载页面。 |
| 文本诊断 | 查看编码、换行、字符统计、不可见字符以及明确选择的清理操作 | Unicode 字素和分词是统计口径。语言工具、出版规范与人工分词可采用其他口径。 |
| 本地文件保护 | 同目录写入后替换、磁盘冲突检查、会话恢复、保存时备份 | 恢复只能使用已写入磁盘的快照。操作系统故障或整盘损坏需要独立备份。 |
| 离线交付 | 各系统和架构的下载包、校验值和执行记录 | 安装、签名及各格式的测试范围以对应发行页和验收记录为准。 |

Notepad++ 迁移支持常见会话、偏好、项目树、菜单快捷键和部分 UDL。Windows 原版插件 DLL、宏、主题、自定义函数定义的完整导入，以及全部 lexer 与代码页属于兼容边界，保留在历史对照和验收记录里。[早期功能矩阵](https://github.com/peterwangze/margin-editor/blob/v0.9.1/docs/research.md#目标矩阵) · [架构](architecture.md)
