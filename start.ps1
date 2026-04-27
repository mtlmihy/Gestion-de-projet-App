# start.ps1 - Lance le backend FastAPI et le frontend Vite en parallele.
#
# Usage :
#   .\start.ps1           # deux fenetres PowerShell separees (defaut)
#   .\start.ps1 -Inline   # logs dans ce terminal (Ctrl+C pour tout arreter)

param([switch]$Inline)

$Root     = $PSScriptRoot
$Backend  = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"

if (-not (Test-Path $Backend))  { Write-Error "Dossier backend introuvable : $Backend";  exit 1 }
if (-not (Test-Path $Frontend)) { Write-Error "Dossier frontend introuvable : $Frontend"; exit 1 }
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { Write-Error "python absent du PATH."; exit 1 }
if (-not (Get-Command npm    -ErrorAction SilentlyContinue)) { Write-Error "npm absent du PATH.";    exit 1 }

# ── Mode inline ────────────────────────────────────────────────────────────
if ($Inline) {
    Write-Host ""
    Write-Host "  Demarrage en mode inline (Ctrl+C pour tout arreter)" -ForegroundColor Cyan
    Write-Host ""

    $jobBack = Start-Job -Name "Backend" -ScriptBlock {
        param($dir)
        Set-Location $dir
        python -m uvicorn app.main:app --reload
    } -ArgumentList $Backend

    $jobFront = Start-Job -Name "Frontend" -ScriptBlock {
        param($dir)
        Set-Location $dir
        npm run dev
    } -ArgumentList $Frontend

    Write-Host "  Backend  -> http://localhost:8000  (job $($jobBack.Id))"  -ForegroundColor Green
    Write-Host "  Frontend -> http://localhost:5173  (job $($jobFront.Id))" -ForegroundColor Green
    Write-Host ""

    try {
        while ($true) {
            Receive-Job -Job $jobBack, $jobFront
            Start-Sleep -Milliseconds 500
        }
    }
    finally {
        Write-Host ""
        Write-Host "  Arret des services..." -ForegroundColor Yellow
        Stop-Job   -Job $jobBack, $jobFront
        Remove-Job -Job $jobBack, $jobFront -Force
        Write-Host "  OK." -ForegroundColor Green
    }
    exit 0
}

# ── Mode fenetres separees (defaut) ────────────────────────────────────────
Write-Host ""
Write-Host "  Ouverture des fenetres..." -ForegroundColor Cyan

$cmdBack  = "Set-Location '$Backend';  python -m uvicorn app.main:app --reload"
$cmdFront = "Set-Location '$Frontend'; npm run dev"

Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmdBack
Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmdFront

Write-Host "  Backend  -> http://localhost:8000" -ForegroundColor Green
Write-Host "  Frontend -> http://localhost:5173" -ForegroundColor Green
Write-Host ""
Write-Host "  Ferme les deux fenetres pour arreter les serveurs." -ForegroundColor DarkGray
