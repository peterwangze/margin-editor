const zh = {
  about: '关于 Margin',
  services: '服务',
  hide: '隐藏 Margin',
  hideOthers: '隐藏其他应用',
  unhide: '全部显示',
  quit: '退出 Margin',
  editMenu: '编辑',
  undo: '撤销',
  redo: '重做',
  cut: '剪切',
  copy: '复制',
  paste: '粘贴',
  pasteAndMatchStyle: '粘贴并匹配样式',
  delete: '删除',
  selectAll: '全选',
  startSpeaking: '开始朗读',
  stopSpeaking: '停止朗读',
  windowMenu: '窗口',
  minimize: '最小化',
  zoom: '缩放',
  front: '全部置于前面',
  close: '关闭',
}

function installMenu(Menu, locale) {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
    return
  }
  if (locale !== 'zh-CN') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([{role: 'appMenu'}, {role: 'editMenu'}, {role: 'windowMenu'}]))
    return
  }
  const items = roles => roles.map(role => role === 'separator' ? {type: 'separator'} : {role, label: zh[role]})
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {role: 'appMenu', submenu: items(['about', 'separator', 'services', 'separator', 'hide', 'hideOthers', 'unhide', 'separator', 'quit'])},
    {role: 'editMenu', label: zh.editMenu, submenu: [...items(['undo', 'redo', 'separator', 'cut', 'copy', 'paste', 'pasteAndMatchStyle', 'delete', 'selectAll', 'separator']), {label: '朗读', submenu: items(['startSpeaking', 'stopSpeaking'])}]},
    {role: 'windowMenu', label: zh.windowMenu, submenu: items(['minimize', 'zoom', 'separator', 'front', 'close'])},
  ]))
}

module.exports = {installMenu}
