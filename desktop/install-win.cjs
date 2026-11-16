const {spawn} = require('node:child_process')
const {randomUUID} = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const {setTimeout: delay} = require('node:timers/promises')
const {compareToStable} = require('./update.cjs')

const versionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/
const resultName = 'update-install-result.json'
const helperFiles = ['package.exe', 'previous.exe', 'ready', 'prepare-error']

const installScript = String.raw`
$ErrorActionPreference = 'Stop'
$staged = Join-Path $spec.work 'package.exe'
$previous = Join-Path $spec.work 'previous.exe'
$ready = Join-Path $spec.work 'ready'
$prepareError = Join-Path $spec.work 'prepare-error'
$result = Join-Path $spec.profile '${resultName}'
$startup = Join-Path $spec.profile 'update-install-ready.json'
$completedHandoff = $false
$parentExited = $false
$prepared = $false
$rollbackNeeded = $false
$newApp = $null

function Is-Version([string] $file, [string] $version) {
    if (-not [IO.File]::Exists($file)) { return $false }
    $info = [Diagnostics.FileVersionInfo]::GetVersionInfo($file)
    return $info.ProductName -eq 'Margin' -and $info.FileVersion -eq $version
}

function Read-Sha256([string] $file) {
    $hash = [Security.Cryptography.SHA256]::Create()
    $stream = [IO.File]::OpenRead($file)
    try { return [BitConverter]::ToString($hash.ComputeHash($stream)).Replace('-', '') }
    finally { $stream.Dispose(); $hash.Dispose() }
}

function Write-Result([string] $status, [string] $message = '') {
    $tempResult = $result + '.' + $spec.parentPid + '.tmp'
    try {
        $json = @{status = $status; version = $spec.artifact.version; message = $message} | ConvertTo-Json -Compress
        [IO.File]::WriteAllText($tempResult, $json)
        if ([IO.File]::Exists($result)) {
            try { [IO.File]::Replace($tempResult, $result, [NullString]::Value) }
            catch { [IO.File]::Copy($tempResult, $result, $true) }
        }
        else { [IO.File]::Move($tempResult, $result) }
    } finally {
        if ([IO.File]::Exists($tempResult)) { [IO.File]::Delete($tempResult) }
    }
}

function Is-RegisteredInstall([Microsoft.Win32.RegistryHive] $hive, [string] $directory, [string] $scope) {
    # NSIS records the quoted uninstaller path, scope switch and display version.
    # Match the running installation without relying on discarded package build metadata.
    $expected = '"' + (Join-Path $directory 'Uninstall Margin.exe') + '" ' + $scope
    foreach ($view in @([Microsoft.Win32.RegistryView]::Registry32, [Microsoft.Win32.RegistryView]::Registry64)) {
        $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, $view)
        try {
            $uninstall = $base.OpenSubKey('Software\Microsoft\Windows\CurrentVersion\Uninstall')
            if ($null -eq $uninstall) { continue }
            try {
                foreach ($name in $uninstall.GetSubKeyNames()) {
                    $entry = $uninstall.OpenSubKey($name)
                    if ($null -eq $entry) { continue }
                    try {
                        if ($entry.GetValue('UninstallString') -eq $expected -and
                            $entry.GetValue('DisplayVersion') -eq $spec.currentVersion) {
                            return $true
                        }
                    } finally { $entry.Dispose() }
                }
            } finally { $uninstall.Dispose() }
        } finally { $base.Dispose() }
    }
    return $false
}

function Get-SetupScope {
    $directory = [IO.Path]::GetDirectoryName($spec.target)
    $perUser = Is-RegisteredInstall ([Microsoft.Win32.RegistryHive]::CurrentUser) $directory '/currentuser'
    $perMachine = Is-RegisteredInstall ([Microsoft.Win32.RegistryHive]::LocalMachine) $directory '/allusers'
    if ($perUser -eq $perMachine) { throw 'The current installation scope could not be established.' }
    if ($perUser) { return '/currentuser' }
    return '/allusers'
}

function Wait-ForMarginProcesses {
    $processName = [IO.Path]::GetFileNameWithoutExtension($spec.target)
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if (-not (Get-Process -Name $processName -ErrorAction SilentlyContinue)) { return }
        Start-Sleep -Milliseconds 250
    }
    throw 'Another Margin process is still using the installation.'
}

function Install-Setup([string] $scope) {
    # Let NSIS elevate its install process for a registered all-users install.
    # /D must be the last argument and unquoted, including spaces.
    $directory = [IO.Path]::GetDirectoryName($spec.target)
    $arguments = '--updated /S ' + $scope + ' /D=' + $directory
    $installer = Start-Process -FilePath $staged -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru
    if ($installer.ExitCode -eq 1223 -or ($installer.ExitCode -eq 0 -and (Is-Version $spec.target $spec.currentVersion))) {
        throw [OperationCanceledException]::new('The installer was cancelled or skipped.')
    }
    if ($installer.ExitCode -ne 0 -or -not (Is-Version $spec.target $spec.artifact.version)) {
        throw ('Setup did not finish with the expected installed version (exit {0}).' -f $installer.ExitCode)
    }
}

function Install-Portable {
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        try {
            [IO.File]::Replace($staged, $spec.target, $previous, $true)
            return
        } catch {
            if ([IO.File]::Exists($previous) -or -not [IO.File]::Exists($staged) -or -not [IO.File]::Exists($spec.target)) { throw }
            $failure = $_.Exception
            while ($null -ne $failure.InnerException) { $failure = $failure.InnerException }
            $code = $failure.HResult -band 65535
            if ($code -in @(5, 32, 33)) {
                # The NSIS portable launcher is still unwinding after the app exited.
                Start-Sleep -Milliseconds 250
                continue
            }
            if ($code -notin @(1, 17, 50, 87, 1175, 1176, 1177)) { throw }
            # FAT and some removable or network volumes do not implement ReplaceFile.
            [IO.File]::Move($spec.target, $previous)
            [IO.File]::Move($staged, $spec.target)
            return
        }
    }
    throw 'The portable executable is still in use or cannot be replaced.'
}

function Restore-Portable {
    if (-not [IO.File]::Exists($previous)) { return }
    if ([IO.File]::Exists($spec.target)) { [IO.File]::Delete($spec.target) }
    [IO.File]::Move($previous, $spec.target)
}

function Launch-Margin([string] $token = '') {
    $env:MARGIN_PROFILE = $spec.profile
    $env:MARGIN_UPDATE_TOKEN = $token
    $launch = @{FilePath = $spec.target; WorkingDirectory = [IO.Path]::GetDirectoryName($spec.target); PassThru = $true}
    if ($spec.relaunchArgs.Count -gt 0) { $launch.ArgumentList = [string[]]$spec.relaunchArgs }
    return Start-Process @launch
}

function Wait-ForStartup([Diagnostics.Process] $launcher) {
    $watch = [Diagnostics.Stopwatch]::StartNew()
    while ($watch.ElapsedMilliseconds -lt 60000) {
        if ($launcher.HasExited) { throw ('The updated app exited during startup (exit {0}).' -f $launcher.ExitCode) }
        if ([IO.File]::Exists($startup)) {
            try { $marker = ConvertFrom-Json ([IO.File]::ReadAllText($startup)) }
            catch { $marker = $null }
            if ($marker.token -eq $spec.token -and $marker.version -eq $spec.artifact.version -and $marker.pid -gt 0) { return }
        }
        Start-Sleep -Milliseconds 250
    }
    throw 'The updated application did not confirm startup.'
}

function Show-InstallError([string] $message) {
    Add-Type -AssemblyName System.Windows.Forms
    [void][Windows.Forms.MessageBox]::Show($message + [Environment]::NewLine + $spec.artifact.path, 'Margin', 'OK', 'Error')
}

try {
    $parent = [Diagnostics.Process]::GetProcessById($spec.parentPid)
    if (-not (Is-Version $spec.target $spec.currentVersion)) { throw 'The current Windows executable could not be verified.' }
    if (-not $spec.portable) { $scope = Get-SetupScope }
    [IO.File]::Copy($spec.artifact.path, $staged, $false)
    $stagedLength = ([IO.FileInfo]::new($staged)).Length
    $stagedDigest = Read-Sha256 $staged
    if ($stagedLength -ne $spec.artifact.size -or $stagedDigest -ne $spec.artifact.digest -or
        -not (Is-Version $staged $spec.artifact.version)) {
        throw 'The staged Windows package did not match the verified release.'
    }
    [IO.File]::WriteAllText($ready, 'ready')
    $prepared = $true
    if (-not $parent.WaitForExit(120000)) { throw 'Margin did not close before the installation began.' }
    $parentExited = $true

    if ($spec.portable) {
        $rollbackNeeded = $true
        Install-Portable
        if (-not (Is-Version $spec.target $spec.artifact.version)) { throw 'The new portable executable could not be verified.' }
    } else {
        Wait-ForMarginProcesses
        Install-Setup $scope
    }
    # A stale result must not appear in the newly launched app.
    Write-Result 'installing'
    $newApp = Launch-Margin $spec.token
    Wait-ForStartup $newApp
    Write-Result 'installed'
    $rollbackNeeded = $false
    $completedHandoff = $true
} catch {
    $message = $_.Exception.Message
    if (-not $prepared) {
        [IO.File]::WriteAllText($prepareError, $message)
    } else {
        $status = if ($_.Exception -is [OperationCanceledException]) { 'cancelled' } else { 'failed' }
        $newAppStillRunning = $null -ne $newApp -and -not $newApp.HasExited
        if ($rollbackNeeded -and -not $newAppStillRunning) {
            try { Restore-Portable; $rollbackNeeded = $false }
            catch { $message += ' The previous portable executable is retained in ' + $previous }
        } elseif ($rollbackNeeded -and [IO.File]::Exists($previous)) {
            $message += ' The previous portable executable is retained in ' + $previous
        }
        try { Write-Result $status $message } catch {}
        if ($newAppStillRunning) {
            Show-InstallError $message
        } elseif ($parentExited) {
            try {
                if (-not ((Is-Version $spec.target $spec.currentVersion) -or (Is-Version $spec.target $spec.artifact.version))) {
                    throw 'No verified Margin executable remains at the original path.'
                }
                $restoredApp = Launch-Margin
                if ($restoredApp.WaitForExit(2500)) { throw 'Margin exited during recovery startup.' }
            } catch {
                Show-InstallError $message
            }
        }
    }
} finally {
    if ($prepared) {
        if ([IO.File]::Exists($staged)) { [IO.File]::Delete($staged) }
        if ($completedHandoff -and [IO.File]::Exists($previous)) { [IO.File]::Delete($previous) }
        if ([IO.File]::Exists($ready)) { [IO.File]::Delete($ready) }
        if (-not [IO.File]::Exists($previous)) { [IO.Directory]::Delete($spec.work, $false) }
    }
}
`

async function removeWorkFiles(work) {
  await Promise.all(helperFiles.map(name => fs.unlink(path.join(work, name)).catch(() => {})))
  await fs.rmdir(work).catch(() => {})
}

async function startWindowsInstall({
  artifact, executable, portableLauncher, profile, currentVersion, parentPid = process.pid, relaunchArgs = [],
}) {
  if (process.platform !== 'win32') throw new Error('Windows installation is unavailable.')
  const portable = Boolean(portableLauncher)
  const target = portable ? portableLauncher : executable
  const digest = typeof artifact?.digest === 'string' && /^(?:sha256:)?([a-f0-9]{64})$/i.exec(artifact.digest)?.[1]
  if (!digest || !versionPattern.test(artifact.version) || !versionPattern.test(currentVersion) ||
    !Number.isSafeInteger(artifact.size) || artifact.size <= 0 || !Number.isSafeInteger(parentPid) || parentPid <= 0 ||
    ![artifact.path, target, profile].every(value => typeof value === 'string' && path.isAbsolute(value)) ||
    path.extname(target).toLowerCase() !== '.exe' || path.extname(artifact.path).toLowerCase() !== '.exe' ||
    path.resolve(artifact.path).toLowerCase() === path.resolve(target).toLowerCase() ||
    !Array.isArray(relaunchArgs) || relaunchArgs.some(argument => typeof argument !== 'string' || !/^--[a-z0-9-]+(?:=[a-z\d.-]+)?$/i.test(argument))) {
    throw new Error('The Windows install request is invalid.')
  }
  if (compareToStable(currentVersion, artifact.version) >= 0) throw new Error('The Windows package is not newer than Margin.')
  if (!portable && path.basename(target).toLowerCase() !== 'margin.exe') throw new Error('The current installation could not be verified.')
  if (!portable) await fs.access(path.join(path.dirname(target), 'Uninstall Margin.exe'))
  const [source, current] = await Promise.all([fs.lstat(artifact.path), fs.lstat(target)])
  if (!source.isFile() || source.size !== artifact.size || !current.isFile()) throw new Error('The Windows update files could not be verified.')

  const systemRoot = process.env.SystemRoot
  if (!systemRoot || !path.isAbsolute(systemRoot)) throw new Error('The Windows installer helper is unavailable.')
  const powershell = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  const work = await fs.mkdtemp(path.join(portable ? path.dirname(target) : profile, '.margin-install-'))
  const spec = {
    artifact: {path: artifact.path, version: artifact.version, size: artifact.size, digest},
    currentVersion, parentPid, portable, profile, target, work, relaunchArgs, token: randomUUID(),
  }
  const manifest = Buffer.from(JSON.stringify(spec)).toString('base64')
  const script = `$spec = ConvertFrom-Json ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${manifest}')))\n${installScript}`
  const command = Buffer.from(script, 'utf16le').toString('base64')
  let helper
  let helperError
  try {
    // Windows PowerShell 5 can exit before evaluating the script if created
    // with DETACHED_PROCESS. Unreferencing the hidden helper still lets Margin
    // exit while the helper waits on the original process handle.
    helper = spawn(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', command], {
      stdio: 'ignore', windowsHide: true,
    })
    helper.once('error', error => { helperError = error })
    const deadline = Date.now() + 90000
    while (Date.now() < deadline) {
      const failure = await fs.readFile(path.join(work, 'prepare-error'), 'utf8').catch(() => null)
      if (failure !== null) throw new Error(failure || 'The Windows installer helper could not prepare the update.')
      if (helperError || helper.exitCode !== null || helper.signalCode !== null) {
        const ended = await fs.readFile(path.join(work, 'prepare-error'), 'utf8').catch(() => '')
        throw new Error(ended || 'The Windows installer helper failed to start.')
      }
      const ready = await fs.readFile(path.join(work, 'ready'), 'utf8').catch(() => null)
      if (ready === 'ready') {
        helper.unref()
        return
      }
      await delay(100)
    }
    throw new Error('The Windows installer helper timed out.')
  } catch (error) {
    if (helper?.pid && helper.exitCode === null && helper.signalCode === null) {
      const exit = new Promise(resolve => helper.once('exit', resolve))
      helper.kill()
      await Promise.race([exit, delay(2000)])
    }
    await removeWorkFiles(work)
    throw error
  }
}

module.exports = {startWindowsInstall}
