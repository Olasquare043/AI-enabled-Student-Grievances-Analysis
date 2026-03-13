param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("backend:dev", "backend:test", "backend:migrate", "backend:seed", "frontend:dev", "frontend:check", "frontend:build", "release:smoke")]
    [string]$Task
)

function Get-BackendPython {
    $pythonPath = Join-Path -Path $PSScriptRoot -ChildPath "..\backend\.venv\Scripts\python.exe"
    $resolvedPath = Resolve-Path -Path $pythonPath -ErrorAction SilentlyContinue
    if (-not $resolvedPath) {
        throw "Backend virtual environment was not found at backend\.venv. Create it first."
    }
    return $resolvedPath.Path
}

switch ($Task) {
    "backend:dev" {
        Push-Location (Join-Path -Path $PSScriptRoot -ChildPath "..\backend")
        try {
            $python = Get-BackendPython
            & $python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
        }
        finally {
            Pop-Location
        }
    }
    "backend:test" {
        Push-Location (Join-Path -Path $PSScriptRoot -ChildPath "..\backend")
        try {
            $python = Get-BackendPython
            & $python -m pytest
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        }
        finally {
            Pop-Location
        }
    }
    "backend:migrate" {
        Push-Location (Join-Path -Path $PSScriptRoot -ChildPath "..\backend")
        try {
            $python = Get-BackendPython
            & $python -m alembic -c alembic.ini upgrade head
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        }
        finally {
            Pop-Location
        }
    }
    "backend:seed" {
        Push-Location (Join-Path -Path $PSScriptRoot -ChildPath "..\backend")
        try {
            $python = Get-BackendPython
            & $python -m app.scripts.seed_demo_data --force-reset
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        }
        finally {
            Pop-Location
        }
    }
    "frontend:dev" {
        Push-Location (Join-Path -Path $PSScriptRoot -ChildPath "..\frontend")
        try {
            npm run dev
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        }
        finally {
            Pop-Location
        }
    }
    "frontend:check" {
        Push-Location (Join-Path -Path $PSScriptRoot -ChildPath "..\frontend")
        try {
            npm run lint
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
            npm run typecheck
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        }
        finally {
            Pop-Location
        }
    }
    "frontend:build" {
        Push-Location (Join-Path -Path $PSScriptRoot -ChildPath "..\frontend")
        try {
            npm run build
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        }
        finally {
            Pop-Location
        }
    }
    "release:smoke" {
        & (Join-Path -Path $PSScriptRoot -ChildPath "release_smoke.ps1")
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
}
