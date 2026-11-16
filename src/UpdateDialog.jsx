import {useEffect, useMemo, useState} from 'react'
import DOMPurify from 'dompurify'
import {marked} from 'marked'
import {Dialog} from './panels'
import {useLocale} from './i18n'
import './update.css'

const releaseNoteTags = [
  'p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
]

function ReleaseNotes({notes}) {
  const {t} = useLocale()
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(notes, {async: false}), {
    ALLOWED_TAGS: releaseNoteTags,
    ALLOWED_ATTR: [],
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
  }), [notes])
  return <section className="update-notes">
    <h3>{t('Release notes')}</h3>
    <div className="update-note-body" dir="auto" dangerouslySetInnerHTML={{__html: html}} />
  </section>
}

function formatPackageSize(bytes, locale) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null
  const unit = bytes >= 1_000_000 ? 'megabyte' : bytes >= 1000 ? 'kilobyte' : 'byte'
  const scale = unit === 'megabyte' ? 1_000_000 : unit === 'kilobyte' ? 1000 : 1
  return new Intl.NumberFormat(locale, {style: 'unit', unit, maximumFractionDigits: 1}).format(bytes / scale)
}

export function UpdateDialog({api, version, close, openLatest}) {
  const {t, locale} = useLocale()
  const [release, setRelease] = useState(null)
  const [checkFailed, setCheckFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [transfer, setTransfer] = useState({phase: 'idle', path: ''})
  const canCheck = Boolean(api?.checkForUpdates)
  const checking = canCheck && !release && !checkFailed
  const available = release?.status === 'available'
  const asset = available ? release.asset : null
  const transferring = transfer.phase === 'downloading' || transfer.phase === 'showing'

  useEffect(() => {
    if (!api?.checkForUpdates) return
    let active = true
    async function check() {
      try {
        const result = await api.checkForUpdates()
        if (active) setRelease(result)
      } catch {
        if (active) setCheckFailed(true)
      }
    }
    void check()
    return () => { active = false }
  }, [api, attempt])

  function retryCheck() {
    setCheckFailed(false)
    setAttempt(value => value + 1)
  }

  async function download() {
    if (!asset || transferring) return
    setTransfer({phase: 'downloading', path: ''})
    try {
      const {path} = await api.downloadUpdate(release.latestVersion)
      setTransfer({phase: 'downloaded', path})
    } catch {
      setTransfer({phase: 'downloadError', path: ''})
    }
  }

  async function showFolder() {
    if (!transfer.path || transferring) return
    setTransfer({...transfer, phase: 'showing'})
    try {
      await api.showDownloadedUpdate()
      setTransfer({...transfer, phase: 'downloaded'})
    } catch {
      setTransfer({...transfer, phase: 'folderError'})
    }
  }

  let status
  if (!canCheck) status = t('Update checks and downloads are available in the desktop app.')
  else if (checking) status = t('Checking for updates…')
  else if (transfer.phase === 'downloading') status = t('Downloading and verifying the package…')
  else if (transfer.path) status = t('Download verified. Open its folder to install the update.')
  else if (available) status = t('An update is available.')
  else if (release?.status === 'current') status = t('Margin is up to date.')
  else if (release?.status === 'ahead') status = t('This installation is newer than the latest release.')

  let error
  if (checkFailed) error = t('Could not check for updates.')
  else if (transfer.phase === 'downloadError') error = t('Could not download the update.')
  else if (transfer.phase === 'folderError') error = t('Could not show the downloaded package.')

  const size = formatPackageSize(asset?.size, locale)

  return <Dialog label="Check for updates" close={close} className="update-dialog">
    <div className="form update-content">
      <dl className="update-versions">
        <div><dt>{t('Current version')}</dt><dd><bdi dir="ltr">{release?.currentVersion ?? version}</bdi></dd></div>
        <div><dt>{t('Latest version')}</dt><dd><bdi dir="ltr">{release?.latestVersion ?? '—'}</bdi></dd></div>
      </dl>
      <p role="status" className="update-status">{status}</p>
      {error && <p role="alert" className="inline-error">{error}</p>}
      {available && <section className="update-package">
        <h3>{t('Matching offline package')}</h3>
        {asset
          ? <p><bdi dir="ltr">{asset.name}</bdi>{size && <> · <bdi>{size}</bdi></>}</p>
          : <p>{t('No offline package is available for this device.')}</p>}
        {transfer.path && <p className="update-download-path"><bdi dir="ltr">{transfer.path}</bdi></p>}
      </section>}
      <div className="update-actions">
        {checkFailed && <button type="button" className="primary-button" onClick={retryCheck}>{t('Try again')}</button>}
        {asset && !transfer.path && <button type="button" className="primary-button" disabled={transferring} onClick={download}>
          {transfer.phase === 'downloadError' ? t('Try again') : t('Download update')}
        </button>}
        {transfer.path && <button type="button" className="primary-button" disabled={transferring} onClick={showFolder}>
          {transfer.phase === 'folderError' ? t('Try again') : t('Show in folder')}
        </button>}
        <button type="button" className="outline-button" onClick={openLatest}>{t('View latest release')}</button>
      </div>
      {available && release.notes?.trim() && <ReleaseNotes notes={release.notes} />}
    </div>
  </Dialog>
}
