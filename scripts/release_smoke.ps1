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
$isWindowsHost = $env:OS -eq "Windows_NT"
$requiresSeparateFrontendBuild = $false
$frontendBuildCommand = ".\scripts\tasks.ps1 frontend:build"

if (-not $SkipBackendMigrate) {
    Invoke-Step -Name "Backend migration check" -Action {
        & (Join-Path $PSScriptRoot "tasks.ps1") "backend:migrate"
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
}

if (-not $SkipBackendTests) {
    Invoke-Step -Name "Backend application test suite" -Action {
        Push-Location $backendDir
        try {
            & $backendPython -m pytest app/tests -q
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        }
        finally {
            Pop-Location
        }
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
        Push-Location $frontendDir
        try {
            npm run lint
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
            npm run typecheck
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        }
        finally {
            Pop-Location
        }
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
}

if (-not $SkipFrontendBuild) {
    if ($isWindowsHost) {
        $requiresSeparateFrontendBuild = $true

        Write-Host ""
        Write-Host "==> Frontend production build"
        Write-Host "INFO: Skipping inline frontend build in this smoke script on Windows."
        Write-Host "INFO: Next.js/Turbopack can fail with 'spawn EPERM' after prior frontend commands in the same long-lived PowerShell session."
        Write-Host "TODO: Run '$frontendBuildCommand' in a fresh PowerShell session to complete the release gate."
    }
    else {
        Invoke-Step -Name "Frontend production build" -Action {
            Push-Location $rootDir
            try {
                npm --prefix frontend run build
                if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
            }
            finally {
                Pop-Location
            }
        }
    }
}

Write-Host ""
if ($requiresSeparateFrontendBuild) {
    Write-Host "Automated smoke checks passed."
    Write-Host "Manual step required to complete the release gate on Windows:"
    Write-Host "  $frontendBuildCommand"
}
else {
    Write-Host "Release smoke checks passed."
}
Write-Host "Runbook recommendation:"
Write-Host "1. Restore demo backup into grievance DB for deterministic demo state."
Write-Host "2. Start backend and frontend."
Write-Host "3. Execute live demo flow (student -> staff -> admin)."
