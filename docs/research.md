# 竞品调研与功能范围

基线为 Notepad++ v8.9.9.1，发布于 2026-11-12。逐章核对官方手册仓库 `1063c51df97e128f7860c6ea13d980eca89b4d10` 的文件、编辑、搜索、视图、会话、编码、宏、插件、UDL、函数列表、运行、CLI 和首选项。功能范围与回归用例使用同一组 ID。基线涵盖内建功能及随官方安装包提供的工具，第三方插件各自的功能按插件兼容性验收。

- **Notepad++** 的菜单、工具栏、标签和状态栏让常用功能可见。列编辑、扩展搜索模式、书签、编码、会话和宏是迁移用户常用工作流。保留这些入口和常用按键。 [官方手册](https://github.com/notepad-plus-plus/npp-usermanual/tree/1063c51df97e128f7860c6ea13d980eca89b4d10/content/docs) · [基线发行版](https://github.com/notepad-plus-plus/notepad-plus-plus/releases/tag/v8.9.9.1)
- **平台和复杂窗口**。官方 FAQ 列出的本机支持是 Windows，窄窗口竖排标签有公开裁切报告。Margin 使用一致的跨平台工作台，标签条允许横向滚动，侧栏可折叠。 [平台 FAQ](https://github.com/notepad-plus-plus/notepad-plus-plus/wiki/FAQ#support-for-systems-other-than-the-ms-windows-family) · [标签裁切报告](https://github.com/notepad-plus-plus/notepad-plus-plus/issues/18594)
- **跨文件替换**。原工具提供文件过滤和递归搜索；公开请求提出目录深度控制。Margin 的结果面板提供过滤、最大深度、可点击结果和替换预览，落盘前再次核对内容。 [搜索手册](https://github.com/notepad-plus-plus/npp-usermanual/blob/1063c51df97e128f7860c6ea13d980eca89b4d10/content/docs/searching.md) · [目录深度请求](https://github.com/notepad-plus-plus/notepad-plus-plus/issues/18544)
- **大文件**。基线手册说明大文件选项可以全局关闭换行。Margin 按文档降低编辑开销，并将超过 48 MiB 的文本切换到约 1 MiB 一页的只读浏览。 [性能选项](https://github.com/notepad-plus-plus/npp-usermanual/blob/1063c51df97e128f7860c6ea13d980eca89b4d10/content/docs/preferences.md#performance)
- **VS Code** 将命令检索、分屏、符号导航、编辑器布局结合到工作台里。借用命令面板和双栏操作，使用传统菜单让低频能力也有固定入口。 [工作台](https://code.visualstudio.com/docs/editing/getting-started/userinterface) · [编辑基础](https://code.visualstudio.com/docs/editing/codebasics)
- **Sublime Text** 把列选择建模成多光标，平台各有适用的按键。Margin 使用可直接输入的多个选择区，提供批量插入和数字序列。 [列选择](https://www.sublimetext.com/docs/column_selection.html)

## 目标矩阵

| ID | 基线能力和增量 | 可接受的结果 |
| --- | --- | --- |
| F01 | 文件、最近记录、拖放、命令行、文件夹、打印、重命名、删除、关联 | 字节落盘可复验，失败有反馈，关闭或退出后可恢复 |
| F02 | 编辑、撤销、列选、多光标、字符面板、覆写、剪贴板历史、行操作、注释和空白 | 多区选择和成组撤销行为可复现，文档外状态一致 |
| F03 | 查找、替换、标记、书签、普通/扩展/正则、选区和多文件 | 高亮、计数、定位、取消、文件过滤、深度限制、逐文件预览和冲突防护 |
| F04 | 多标签、双视图/克隆、同步滚动、迷你地图、函数列表、跟踪日志、文档列表 | 光标、滚动及活动文件状态清楚，分屏与内容一致 |
| F05 | UTF、ANSI、各地区代码页、重解释和转码、混合换行 | 重解释与转码独立，未修改文件保留原始字节，损失显式阻止 |
| F06 | 内建语法、补全、参数提示、自动闭合、UDL 与自定义函数规则 | 按文件识别并可覆写，用迁移文件核对语法、折叠和词组 |
| F07 | 会话、快照、备份、项目列表、日志跟踪 | 重启恢复，外部修改提示，保存失败仍可继续编辑 |
| F08 | 宏录制、保存、回放、重复、Run 菜单和快捷键 | 相对当前位置重放，运行由明确用户操作触发 |
| F09 | 配色、设置、快捷键、菜单/工具栏、语言和状态项 | 键盘可操作，设置持久化，深浅主题可用 |
| F10 | 插件管理、插件/lexer API、NppExport、Converter、Mime Tool | 内置工具结果可比对，第三方 Windows DLL 互操作单独验证 |
| F11 | Windows 集成、CLI 参数、安装选项、便携版本 | 按系统验证启动、文件关联、安装与卸载；发布 SHA-256 |
| F12 | 增量：命令面板、差异、Markdown、JSON、日志 | 核心流本地可用，界面不要求联网或登录 |

Windows DLL、Win32 消息和 Scintilla ABI 是平台级兼容需求。Electron 进程使用不同的编辑器模型，完整兼容需要 Windows 桥接、文档与选区映射、插件生命周期和真实插件回归矩阵。macOS 与 Linux 也需要定义对应的本机插件方案。版本验收必须明确记录这部分及其余功能的实际覆盖。
