# MANOA - start script
# Lance le backend (port 4000), le frontend (port 5173) et l'orbite de bureau

$ErrorActionPreference = "SilentlyContinue"

Set-Location $PSScriptRoot

Write-Host ""
Write-Host "  ============================================="
Write-Host "   MANOA - Matrix AI Technician"
Write-Host "  ============================================="
Write-Host ""

$backend = "backend"
$frontend = "frontend"

if (-not (Test-Path "$backend\node_modules")) {
  Write-Host "[1/5] Installation du backend..."
  Push-Location $backend
  cmd /c "npm install --no-audit --no-fund"
  Pop-Location
}

if (-not (Test-Path "$frontend\node_modules")) {
  Write-Host "[2/5] Installation du frontend..."
  Push-Location $frontend
  cmd /c "npm install --no-audit --no-fund"
  Pop-Location
}

Write-Host "[3/5] Demarrage du backend  -> http://localhost:4000"
Push-Location $backend
Start-Process -FilePath "node" -ArgumentList "src/server.js" -WindowStyle Hidden
Pop-Location

Write-Host "[4/5] Demarrage du frontend -> http://localhost:5173"
Push-Location $frontend
Start-Process -FilePath "cmd" -ArgumentList "/c","npm run dev" -WindowStyle Hidden
Pop-Location

Write-Host "[5/5] Demarrage de l'orbite de bureau MANOA"
$orbExe = Join-Path $PSScriptRoot "ManoaOrb.exe"
if (Test-Path $orbExe) {
    Start-Process $orbExe
} else {
    Start-Process -FilePath "powershell" -ArgumentList "-ExecutionPolicy Bypass -File `"$PSScriptRoot\desktop-orb.ps1`""
}

Start-Sleep -Seconds 8
Write-Host ""
Write-Host "  MANOA est pret !"
Write-Host "  Orbite de bureau active (coin inferieur droit)"
Write-Host "  Cliquez sur l'orbite pour ouvrir l'assistant"
Write-Host "  Clic droit sur l'orbite pour le fermer"
Write-Host "  Frontend : http://localhost:5173"
Write-Host ""
