const simplified = {
  saveDocument: '保存文档',
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
  speech: '朗读',
  windowMenu: '窗口',
  minimize: '最小化',
  zoom: '缩放',
  front: '全部置于前面',
  close: '关闭',
}

const traditional = {
  saveDocument: '儲存文件',
  about: '關於 Margin',
  services: '服務',
  hide: '隱藏 Margin',
  hideOthers: '隱藏其他應用程式',
  unhide: '全部顯示',
  quit: '結束 Margin',
  editMenu: '編輯',
  undo: '復原',
  redo: '重做',
  cut: '剪下',
  copy: '複製',
  paste: '貼上',
  pasteAndMatchStyle: '貼上並符合樣式',
  delete: '刪除',
  selectAll: '全選',
  startSpeaking: '開始朗讀',
  stopSpeaking: '停止朗讀',
  speech: '朗讀',
  windowMenu: '視窗',
  minimize: '最小化',
  zoom: '縮放',
  front: '全部移到最前方',
  close: '關閉',
}

const japanese = {
  saveDocument: '文書を保存',
  about: 'Margin について',
  services: 'サービス',
  hide: 'Margin を隠す',
  hideOthers: 'ほかを隠す',
  unhide: 'すべてを表示',
  quit: 'Margin を終了',
  editMenu: '編集',
  undo: '取り消す',
  redo: 'やり直す',
  cut: 'カット',
  copy: 'コピー',
  paste: 'ペースト',
  pasteAndMatchStyle: 'ペーストしてスタイルを合わせる',
  delete: '削除',
  selectAll: 'すべてを選択',
  startSpeaking: '読み上げを開始',
  stopSpeaking: '読み上げを停止',
  speech: '読み上げ',
  windowMenu: 'ウインドウ',
  minimize: '最小化',
  zoom: '拡大／縮小',
  front: 'すべてを手前に移動',
  close: '閉じる',
}

const korean = {
  saveDocument: '문서 저장',
  about: 'Margin 정보',
  services: '서비스',
  hide: 'Margin 가리기',
  hideOthers: '기타 가리기',
  unhide: '모두 보기',
  quit: 'Margin 종료',
  editMenu: '편집',
  undo: '실행 취소',
  redo: '다시 실행',
  cut: '오려두기',
  copy: '복사',
  paste: '붙여넣기',
  pasteAndMatchStyle: '붙여넣고 스타일 일치시키기',
  delete: '삭제',
  selectAll: '모두 선택',
  startSpeaking: '말하기 시작',
  stopSpeaking: '말하기 중단',
  speech: '말하기',
  windowMenu: '윈도우',
  minimize: '최소화',
  zoom: '확대/축소',
  front: '모두 앞으로 가져오기',
  close: '닫기',
}

const nativeLabels = new Map([['zh-CN', simplified], ['zh-TW', traditional], ['ja', japanese], ['ko', korean]])

function saveDialogTitle(locale) {
  return nativeLabels.get(locale)?.saveDocument ?? 'Save document'
}

function installMenu(Menu, locale) {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
    return
  }
  const labels = nativeLabels.get(locale)
  if (!labels) {
    Menu.setApplicationMenu(Menu.buildFromTemplate([{role: 'appMenu'}, {role: 'editMenu'}, {role: 'windowMenu'}]))
    return
  }
  const items = roles => roles.map(role => role === 'separator' ? {type: 'separator'} : {role, label: labels[role]})
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {role: 'appMenu', submenu: items(['about', 'separator', 'services', 'separator', 'hide', 'hideOthers', 'unhide', 'separator', 'quit'])},
    {role: 'editMenu', label: labels.editMenu, submenu: [...items(['undo', 'redo', 'separator', 'cut', 'copy', 'paste', 'pasteAndMatchStyle', 'delete', 'selectAll', 'separator']), {label: labels.speech, submenu: items(['startSpeaking', 'stopSpeaking'])}]},
    {role: 'windowMenu', label: labels.windowMenu, submenu: items(['minimize', 'zoom', 'separator', 'front', 'close'])},
  ]))
}

module.exports = {installMenu, saveDialogTitle}
