# MANOA companion - demarrage en developpement
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path "node_modules")) {
  Write-Host "[1/2] Installation des dependances..."
  npm install --no-audit --no-fund
}

Write-Host "[2/2] Lancement du compagnon MANOA (tray)..."
Write-Host "      Astuce : dites 'MANOA', 'MAN' ou 'MATRIX' pour l'eveiller."
npm start
