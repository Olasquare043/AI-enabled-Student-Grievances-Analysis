param(
    [switch]$SkipBackendMigrate,
    [switch]$SkipBackendTests,
    [switch]$SkipIntegrationTests,
    [switch]$SkipFrontendChecks,
    [switch]$SkipFrontendBuild
)

$ErrorActionPreference = "Stop"

function Get-BackendPython {
    $pythonPath = Join-Path -Path $PSScriptRoot -ChildPath "..\backend\.venv\Scripts\python.exe"
    $resolvedPath = Resolve-Path -Path $pythonPath -ErrorAction SilentlyContinue
    if (-not $resolvedPath) {
        throw "Backend virtual environment was not found at backend\.venv. Create it first."
    }
    return $resolvedPath.Path
}

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        [scriptblock]$Action
    )

    Write-Host ""
    Write-Host "==> $Name"
    & $Action
    Write-Host "PASS: $Name"
}

$backendPython = Get-BackendPython
$rootDir = Resolve-Path (Join-Path -Path $PSScriptRoot -ChildPath "..")
$backendDir = Join-Path -Path $rootDir -ChildPath "backend"
$frontendDir = Join-Path -Path $rootDir -ChildPath "frontend"

if (-not $SkipBackendMigrate) {
    Invoke-Step -Name "Backend migration check" -Action {
        & (Join-Path $PSScriptRoot "tasks.ps1") "backend:migrate"
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
}

if (-not $SkipBackendTests) {
    Invoke-Step -Name "Backend full test suite" -Action {
        & (Join-Path $PSScriptRoot "tasks.ps1") "backend:test"
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
}

if (-not $SkipIntegrationTests) {
    Invoke-Step -Name "Backend release integration tests" -Action {
        Push-Location $backendDir
        try {
            & $backendPython -m pytest tests/integration -q
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        }
        finally {
            Pop-Location
        }
    }
}

if (-not $SkipFrontendChecks) {
    Invoke-Step -Name "Frontend lint + typecheck" -Action {
        & (Join-Path $PSScriptRoot "tasks.ps1") "frontend:check"
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
}

if (-not $SkipFrontendBuild) {
    Invoke-Step -Name "Frontend production build" -Action {
        Push-Location $frontendDir
        try {
            npm run build
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        }
        finally {
            Pop-Location
        }
    }
}

Write-Host ""
Write-Host "Release smoke checks passed."
Write-Host "Runbook recommendation:"
Write-Host "1. Restore demo backup into grievance DB for deterministic demo state."
Write-Host "2. Start backend and frontend."
Write-Host "3. Execute live demo flow (student -> staff -> admin)."
