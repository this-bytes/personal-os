$ErrorActionPreference = 'Continue'

# The repository root is the parent of the directory this script lives in.
# Resolving it from the script's own location keeps the script working in any
# checkout, on any machine, instead of only on the one that wrote it.
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$key = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 255 }))
$env:PERSONAL_OS_SECRET_KEY = $key
$env:PERSONAL_OS_PORT = "4317"

Write-Output "== building and starting the stack =="
docker compose -f deploy/compose.yaml up -d --build 2>&1 | Select-Object -Last 12

Write-Output ""
Write-Output "== waiting for the server =="
$ok = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 3
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:4317/api/health" -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200) {
      Write-Output ("health: " + $r.Content)
      $ok = $true
      break
    }
  } catch {
    # keep waiting
  }
}

if (-not $ok) {
  Write-Output "== the stack did not become healthy =="
  docker compose -f deploy/compose.yaml ps
  docker compose -f deploy/compose.yaml logs --tail 40
  docker compose -f deploy/compose.yaml down -v
  exit 1
}

Write-Output ""
Write-Output "== containers =="
docker compose -f deploy/compose.yaml ps

Write-Output ""
Write-Output "== the web client is served by the API =="
try {
  $page = Invoke-WebRequest -Uri "http://127.0.0.1:4317/" -UseBasicParsing -TimeoutSec 10
  Write-Output ("index.html status: " + $page.StatusCode + ", bytes: " + $page.Content.Length)
  if ($page.Content -notmatch '<div id="root">') {
    Write-Output "WARNING: the served page does not look like the web client"
  }
} catch {
  Write-Output ("index.html failed: " + $_.Exception.Message)
}

Write-Output ""
Write-Output "== teardown =="
docker compose -f deploy/compose.yaml down -v 2>&1 | Select-Object -Last 6
