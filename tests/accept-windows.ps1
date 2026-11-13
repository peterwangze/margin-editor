param(
    [Parameter(Mandatory = $true)][ValidateSet('x64', 'arm64')][string] $Arch,
    [Parameter(Mandatory = $true)][string] $Evidence
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$version = node -p 'require("./package.json").version'
$setup = Get-Item -LiteralPath "release/Margin-$version-win-$Arch-setup.exe"
$portable = Get-Item -LiteralPath "release/Margin-$version-win-$Arch-portable.exe"
$target = Join-Path $env:RUNNER_TEMP 'Margin acceptance'
$env:MARGIN_EVIDENCE = (New-Item -ItemType Directory -Path $Evidence -Force).FullName

function Assert-WindowsExecutable {
    param([Parameter(Mandatory = $true)][string] $Path)
    $metadata = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($Path)
    if ($metadata.ProductName -ne 'Margin' -or $metadata.FileVersion -ne $version) {
        throw "Wrong executable metadata: $Path ($($metadata.ProductName) $($metadata.FileVersion))"
    }
    $signature = (Get-AuthenticodeSignature -LiteralPath $Path).Status
    Write-Host "Windows metadata: $($metadata.FileVersion); Authenticode: $signature; $Path"
}

function Invoke-PackagedAcceptance {
    param([string] $Path, [string] $Form)
    $env:MARGIN_EXECUTABLE = $Path
    $env:MARGIN_PACKAGE_FORM = $Form
    node tests/packaged-smoke.mjs
}

Assert-WindowsExecutable -Path $setup.FullName
Assert-WindowsExecutable -Path $portable.FullName
if (Test-Path -LiteralPath $target) { throw "Acceptance installation directory already exists: $target" }
$installation = Start-Process -FilePath $setup.FullName -ArgumentList '/S', "/D=$target" -WindowStyle Hidden -Wait -PassThru
if ($installation.ExitCode -ne 0) { throw "NSIS install exit code $($installation.ExitCode)" }

try {
    $exe = Join-Path $target 'Margin.exe'
    Assert-WindowsExecutable -Path $exe
    $reader = [System.IO.BinaryReader]::new([System.IO.File]::OpenRead($exe))
    try {
        if ($reader.ReadUInt16() -ne 0x5A4D) { throw 'Installed application lacks an MZ header' }
        $reader.BaseStream.Position = 0x3c
        $reader.BaseStream.Position = $reader.ReadUInt32()
        if ($reader.ReadUInt32() -ne 0x4550) { throw 'Installed application lacks a PE header' }
        $actual = $reader.ReadUInt16()
        $expected = if ($Arch -eq 'arm64') { 0xaa64 } else { 0x8664 }
        if ($actual -ne $expected) { throw "Installed PE architecture does not match $Arch" }
    } finally {
        $reader.Dispose()
    }
    Get-Item -LiteralPath (Join-Path $target 'resources/app.asar'), (Join-Path $target 'icudtl.dat') | Out-Host
    Invoke-PackagedAcceptance -Path $exe -Form setup
    $env:MARGIN_EXECUTABLE = $exe
    npm.cmd run test:desktop
} finally {
    $uninstaller = @(Get-ChildItem -LiteralPath $target -Filter 'Uninstall*.exe')
    if ($uninstaller.Count -ne 1) { throw "Expected an uninstaller in $target" }
    $removal = Start-Process -FilePath $uninstaller[0].FullName -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
    if ($removal.ExitCode -ne 0 -or (Test-Path -LiteralPath (Join-Path $target 'Margin.exe'))) {
        throw "NSIS uninstall did not remove Margin.exe (exit code $($removal.ExitCode))"
    }
}

# The NSIS portable launcher starts and waits for the embedded application.
Invoke-PackagedAcceptance -Path $portable.FullName -Form portable
'Windows metadata, installed PE architecture, bundled runtime, NSIS install and uninstall, and portable launch passed.' |
    Set-Content -Encoding utf8 -LiteralPath (Join-Path $env:MARGIN_EVIDENCE 'package-checks.txt')
