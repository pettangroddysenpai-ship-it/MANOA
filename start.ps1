# MANOA - start script
# Lance le backend (port 4000) et le frontend (port 5173)

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
  Write-Host "[1/4] Installation du backend..."
  Push-Location $backend
  cmd /c "npm install --no-audit --no-fund"
  Pop-Location
}

if (-not (Test-Path "$frontend\node_modules")) {
  Write-Host "[2/4] Installation du frontend..."
  Push-Location $frontend
  cmd /c "npm install --no-audit --no-fund"
  Pop-Location
}

Write-Host "[3/4] Demarrage du backend  -> http://localhost:4000"
Push-Location $backend
Start-Process -FilePath "node" -ArgumentList "src/server.js" -WindowStyle Hidden
Pop-Location

Write-Host "[4/4] Demarrage du frontend -> http://localhost:5173"
Push-Location $frontend
Start-Process -FilePath "cmd" -ArgumentList "/c","npm run dev" -WindowStyle Hidden
Pop-Location

Start-Sleep -Seconds 8
Write-Host ""
Write-Host "  MANOA est pret !"
Write-Host "  Ouvrez http://localhost:5173 dans votre navigateur"
Write-Host "  (Utilisez Chrome pour la voix)"
Write-Host ""
