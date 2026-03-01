param(
    [string]$DatabaseUrl = $env:DATABASE_URL,
    [string]$OutputDir = (Join-Path -Path $PSScriptRoot -ChildPath "..\backups"),
    [ValidateSet("custom", "plain")]
    [string]$Format = "custom",
    [string]$Label = "",
    [string]$PgBinPath = ""
)

$ErrorActionPreference = "Stop"

function Parse-DatabaseUrl {
    param([Parameter(Mandatory = $true)][string]$Url)

    $normalized = $Url.Trim()
    $normalized = $normalized -replace "^postgresql\+psycopg://", "postgresql://"
    if ($normalized -notmatch "^postgresql://") {
        throw "Unsupported DATABASE_URL format. Expected postgresql+psycopg://..."
    }

    $uri = [System.Uri]$normalized
    if (-not $uri.AbsolutePath -or $uri.AbsolutePath -eq "/") {
        throw "Database URL is missing a database name."
    }

    $userInfoParts = $uri.UserInfo.Split(":", 2)
    if ($userInfoParts.Length -lt 1 -or [string]::IsNullOrWhiteSpace($userInfoParts[0])) {
        throw "Database URL is missing a username."
    }

    $username = [System.Uri]::UnescapeDataString($userInfoParts[0])
    $password = ""
    if ($userInfoParts.Length -eq 2) {
        $password = [System.Uri]::UnescapeDataString($userInfoParts[1])
    }

    return [pscustomobject]@{
        Host = if ([string]::IsNullOrWhiteSpace($uri.Host)) { "localhost" } else { $uri.Host }
        Port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
        Username = $username
        Password = $password
        Database = $uri.AbsolutePath.TrimStart("/")
    }
}

function Resolve-PgTool {
    param(
        [Parameter(Mandatory = $true)][string]$ToolName,
        [string]$BinPath = ""
    )

    if (-not [string]::IsNullOrWhiteSpace($BinPath)) {
        $candidate = Join-Path -Path $BinPath -ChildPath "$ToolName.exe"
        if (Test-Path $candidate) {
            return (Resolve-Path $candidate).Path
        }
        throw "Could not find $ToolName.exe under PgBinPath: $BinPath"
    }

    $command = Get-Command $ToolName -ErrorAction SilentlyContinue
    if ($null -ne $command) {
        return $command.Source
    }

    throw "$ToolName was not found on PATH. Add PostgreSQL bin to PATH or pass -PgBinPath."
}

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    throw "DatabaseUrl is required. Pass -DatabaseUrl or set DATABASE_URL."
}

$connection = Parse-DatabaseUrl -Url $DatabaseUrl
$pgDump = Resolve-PgTool -ToolName "pg_dump" -BinPath $PgBinPath

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$safeLabel = $Label.Trim()
if ($safeLabel) {
    $safeLabel = "-" + ($safeLabel -replace "[^A-Za-z0-9\-_]", "_")
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$extension = if ($Format -eq "custom") { "dump" } else { "sql" }
$backupFile = Join-Path -Path $OutputDir -ChildPath "$($connection.Database)-$timestamp$safeLabel.$extension"
$metadataFile = "$backupFile.meta.json"

$previousPassword = $env:PGPASSWORD
try {
    if (-not [string]::IsNullOrWhiteSpace($connection.Password)) {
        $env:PGPASSWORD = $connection.Password
    }

    $dumpArgs = @(
        "--host=$($connection.Host)"
        "--port=$($connection.Port)"
        "--username=$($connection.Username)"
        "--format=$Format"
        "--no-owner"
        "--no-privileges"
        "--file=$backupFile"
        $connection.Database
    )

    & $pgDump @dumpArgs
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed with exit code $LASTEXITCODE"
    }
}
finally {
    if ($null -eq $previousPassword) {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    } else {
        $env:PGPASSWORD = $previousPassword
    }
}

$backupInfo = [pscustomobject]@{
    created_at_utc = (Get-Date).ToUniversalTime().ToString("o")
    source_host = $connection.Host
    source_port = $connection.Port
    source_database = $connection.Database
    source_username = $connection.Username
    format = $Format
    backup_file = (Resolve-Path $backupFile).Path
}

$backupInfo | ConvertTo-Json -Depth 5 | Set-Content -Path $metadataFile -Encoding UTF8

Write-Host "Backup completed successfully:"
Write-Host "  File: $backupFile"
Write-Host "  Metadata: $metadataFile"
