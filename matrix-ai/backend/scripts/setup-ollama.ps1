# MANOA - installation d'Ollama (LLM local 100 % hors ligne)
# Usage : powershell -ExecutionPolicy Bypass -File setup-ollama.ps1 [-Model qwen3:4b] [-Embed nomic-embed-text]
# - Model  : modele de chat (choisissez selon la RAM : 3b/4b rapides, 7b/8b plus precis mais lents)
# - Embed   : modele d'embedding pour la base de connaissances
$ErrorActionPreference = "Stop"

param(
  [string]$Model = "qwen3:4b",
  [string]$Embed = "nomic-embed-text"
)

Write-Host ""
Write-Host "  ============================================="
Write-Host "   MANOA - Ollama (IA locale hors ligne)"
Write-Host "  ============================================="
Write-Host ""

# 1. Localiser ollama
function Find-Ollama {
  $cmd = Get-Command ollama -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe",
    "C:\Program Files\Ollama\ollama.exe"
  )
  foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
  return $null
}

$ollama = Find-Ollama
if (-not $ollama) {
  Write-Host "[1/4] Ollama n'est pas installe. Installation en cours..."
  $setup = "$env:TEMP\OllamaSetup.exe"
  Write-Host "  telechargement : https://ollama.com/download/OllamaSetup.exe"
  curl.exe -L --fail --retry 3 --retry-delay 5 -o $setup "https://ollama.com/download/OllamaSetup.exe"
  if (-not (Test-Path $setup) -or (Get-Item $setup).Length -lt 1MB) {
    throw "Telechargement d'Ollama echoue."
  }
  Write-Host "  installation silencieuse..."
  Start-Process -FilePath $setup -ArgumentList "/VERYSILENT", "/NORESTART" -Wait
  Remove-Item $setup -Force -ErrorAction SilentlyContinue
  $ollama = Find-Ollama
  if (-not $ollama) {
    # apres installation, relancer la recherche dans le dossier utilisateur
    Start-Sleep -Seconds 3
    $ollama = Find-Ollama
  }
  if (-not $ollama) { throw "Ollama installe mais executable introuvable." }
} else {
  Write-Host "[1/4] Ollama deja installe : $ollama"
}

# 2. Demarrer le service Ollama
Write-Host "[2/4] Demarrage du service Ollama..."
try {
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "start", "`"`"", "`"$ollama`"", "serve" -WindowStyle Hidden
} catch {
  Write-Host "  (deja lance ?)"
}
$ready = $false
for ($i = 0; $i -lt 20; $i++) {
  try {
    $r = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 2
    if ($null -ne $r) { $ready = $true; break }
  } catch { Start-Sleep -Milliseconds 800 }
}
if (-not $ready) {
  # tentative : lancer l'app en arriere-plan puis reverifier
  Start-Process $ollama -ArgumentList "serve"
  Start-Sleep -Seconds 5
}
try { $r = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 2; $ready = $true } catch { $ready = $false }
if (-not $ready) { throw "Ollama ne repond pas sur http://127.0.0.1:11434" }
Write-Host "  Ollama pret sur http://127.0.0.1:11434"

# 3. Pull des modeles
function Ensure-Model {
  param([string]$Name)
  $have = $r.models | Where-Object { $_.name -eq $Name -or $_.name.StartsWith("$($Name.Split(':')[0]):") }
  if ($have) { Write-Host "  $Name deja present."; return }
  Write-Host "  telechargement de $Name (peut prendre plusieurs minutes)..."
  & $ollama pull $Name
  if ($LASTEXITCODE -ne 0) { throw "Echec du pull de $Name" }
}

Write-Host "[3/4] Verification des modeles..."
Ensure-Model -Name $Model
Ensure-Model -Name $Embed

# 4. Recapitulatif
Write-Host "[4/4] Termine."
Write-Host ""
Write-Host "  Modele de chat   : $Model"
Write-Host "  Modele d'embed   : $Embed"
Write-Host "  Ollama           : http://127.0.0.1:11434"
Write-Host ""
Write-Host "  Redemarrez le backend MANOA pour qu'il utilise Ollama."
Write-Host "  (backend\.env : OLLAMA_MODEL / OLLAMA_EMBED_MODEL pour changer)"
Write-Host ""
