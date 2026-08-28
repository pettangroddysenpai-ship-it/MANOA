# Construction de l'installateur Windows (electron-builder / NSIS)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot   # matrix-ai
$comp = $PSScriptRoot                     # companion
$NodeVersion = "20.18.0"

Write-Host ""
Write-Host "  ============================================="
Write-Host "   MANOA - Construction de l'installateur"
Write-Host "  ============================================="
Write-Host ""

# 1. Dependances du companion
Push-Location $comp
if (-not (Test-Path "node_modules")) {
  Write-Host "[1/6] npm install (companion)..."
  npm install --no-audit --no-fund
} else {
  Write-Host "[1/6] node_modules du companion deja presents"
}
Pop-Location

# 2. Build du frontend
Push-Location "$root\frontend"
if (-not (Test-Path "node_modules")) {
  Write-Host "[2/6] npm install (frontend)..."
  npm install --no-audit --no-fund
}
Write-Host "[2/6] Build du frontend (vite)..."
npm run build
Pop-Location

# 3. Preparation du bundle (backend + frontend build + node.exe) pour electron-builder
$bundle = "$comp\bundled"
if (Test-Path $bundle) { Remove-Item -Recurse -Force $bundle }
New-Item -ItemType Directory -Path $bundle | Out-Null

Write-Host "[3/6] Copie du backend (sans .env ni data)..."
robocopy "$root\backend" "$bundle\backend" /E /NFL /NDL /NJH /NJS /NP /XD node_modules\.cache data uploads /XF .env > $null
robocopy "$root\backend\node_modules" "$bundle\backend\node_modules" /E /NFL /NDL /NJH /NJS /NP /XD .cache > $null

Write-Host "[4/6] Copie du frontend build..."
robocopy "$root\frontend\dist" "$bundle\frontend" /E /NFL /NDL /NJH /NJS /NP > $null

# 4. Runtime Node embarque (le poste de l'utilisateur final n'a pas forcement node.exe)
Write-Host "[5/6] Telechargement de Node $NodeVersion (runtime backend)..."
$nodeZip = "$env:TEMP\node-v$NodeVersion-win-x64.zip"
$nodeExe = "$bundle\node\node.exe"
New-Item -ItemType Directory -Path "$bundle\node" -Force | Out-Null
if (-not (Test-Path $nodeExe)) {
  $nodeUrls = @(
    "https://registry.npmmirror.com/-/binary/node/v$NodeVersion/node-v$NodeVersion-win-x64.zip",
    "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip"
  )
  $ok = $false
  foreach ($u in $nodeUrls) {
    try {
      Write-Host "  essai : $u"
      curl.exe -L --fail --retry 5 --retry-delay 5 -C - -o $nodeZip $u
      if ((Test-Path $nodeZip) -and ((Get-Item $nodeZip).Length -gt 5MB)) { $ok = $true; break }
    } catch {
      Write-Host "  echec, mirror suivant"
    }
  }
  if (-not $ok) { throw "Impossible de telecharger Node $NodeVersion" }
  Push-Location "$bundle\node"
  tar.exe -xf $nodeZip --strip-components=1 "node-v$NodeVersion-win-x64\node.exe"
  if (-not $?) { tar.exe -xf $nodeZip "node-v$NodeVersion-win-x64/node.exe"; Move-Item "node-v$NodeVersion-win-x64\node.exe" . ; Remove-Item "node-v$NodeVersion-win-x64" -Recurse -Force }
  Pop-Location
}
if (-not (Test-Path $nodeExe)) { throw "node.exe absent apres extraction" }
Write-Host "  node.exe pret ($((Get-Item $nodeExe).Length / 1MB | ForEach-Object { [math]::Round($_,1) }) MB)"

# 5. electron-builder
Write-Host "[6/6] electron-builder --win nsis..."
Push-Location $comp
npm run icons
npx electron-builder --win nsis --x64
Pop-Location

Write-Host ""
Write-Host "  Installateur genere dans : $comp\dist"
Write-Host ""
