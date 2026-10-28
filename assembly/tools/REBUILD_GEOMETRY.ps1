param(
  [string]$WorkDirectory = (Join-Path $PSScriptRoot 'download-work'),
  [string]$OutputAssemblyDirectory = (Join-Path $PSScriptRoot 'rebuilt-assembly')
)
$ErrorActionPreference = 'Stop'
$taskWork = [IO.Path]::GetFullPath($WorkDirectory)
$taskOutput = [IO.Path]::GetFullPath($OutputAssemblyDirectory)
New-Item -ItemType Directory -Path $taskWork -Force | Out-Null
$taskUpstream = Join-Path $taskWork 'upstream'
New-Item -ItemType Directory -Path $taskUpstream -Force | Out-Null
$taskRecord = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'SOURCE_DOWNLOADS.json') -Raw | ConvertFrom-Json
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'SOURCE_DOWNLOADS.json') -Destination (Join-Path $taskWork 'download-record.json')
foreach ($taskFile in $taskRecord.files) {
  $taskFileName = Split-Path -Leaf $taskFile.path
  $taskDestination = Join-Path $taskUpstream $taskFileName
  Invoke-WebRequest -Uri $taskFile.url -OutFile $taskDestination
  $taskHash = (Get-FileHash -LiteralPath $taskDestination -Algorithm SHA256).Hash.ToLower()
  if ($taskHash -ne $taskFile.sha256) { throw "Source hash mismatch: $taskFileName" }
}
$taskManifest = Get-Content -LiteralPath (Join-Path $taskUpstream 'upstream-manifest.json') -Raw | ConvertFrom-Json
$taskArchive = $taskManifest.files.archive
$taskZipPath = Join-Path $taskWork 'bodyparts3d-official-isa.zip'
Invoke-WebRequest -Uri $taskArchive.url -OutFile $taskZipPath
if ((Get-FileHash -LiteralPath $taskZipPath -Algorithm SHA256).Hash.ToLower() -ne $taskArchive.sha256) { throw 'Official BodyParts3D archive hash mismatch.' }
$taskWanted = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'OBJ_ELEMENT_IDS.json') -Raw | ConvertFrom-Json
$taskOBJDirectory = Join-Path $taskWork 'official-missing-obj'
New-Item -ItemType Directory -Path $taskOBJDirectory -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskZip = [IO.Compression.ZipFile]::OpenRead($taskZipPath)
$taskObjects = @()
try {
  foreach ($taskEntry in $taskZip.Entries) {
    $taskElement = [IO.Path]::GetFileNameWithoutExtension($taskEntry.Name)
    if ($taskWanted -contains $taskElement -and $taskEntry.Name.EndsWith('.obj')) {
      $taskDestination = Join-Path $taskOBJDirectory ($taskElement + '.obj')
      [IO.Compression.ZipFileExtensions]::ExtractToFile($taskEntry, $taskDestination, $true)
      $taskObjects += [pscustomobject]@{ elementId=$taskElement; archiveEntry=$taskEntry.FullName; bytes=$taskEntry.Length }
    }
  }
} finally { $taskZip.Dispose() }
$taskObjects | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $taskWork 'obj-extraction-record.json')
& node (Join-Path $PSScriptRoot 'rebuild-official-assembly.cjs') --audit $taskWork --template (Join-Path $PSScriptRoot 'CATALOG_TEMPLATE.json') --output $taskOutput
if ($LASTEXITCODE -ne 0) { throw 'Geometry rebuild failed.' }
Write-Output ('Rebuilt static geometry: ' + $taskOutput)
