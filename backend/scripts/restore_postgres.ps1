param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,
    [string]$DatabaseUrl = $env:DATABASE_URL,
    [string]$PgBinPath = "",
    [switch]$DropExisting,
    [switch]$Force
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

$resolvedBackupFile = Resolve-Path $BackupFile -ErrorAction SilentlyContinue
if ($null -eq $resolvedBackupFile) {
    throw "Backup file not found: $BackupFile"
}
$backupPath = $resolvedBackupFile.Path

$connection = Parse-DatabaseUrl -Url $DatabaseUrl
$backupExtension = [System.IO.Path]::GetExtension($backupPath).ToLowerInvariant()

$restoreWithPgRestore = $backupExtension -in @(".dump", ".backup", ".dmp")
$restorer = if ($restoreWithPgRestore) {
    Resolve-PgTool -ToolName "pg_restore" -BinPath $PgBinPath
} else {
    Resolve-PgTool -ToolName "psql" -BinPath $PgBinPath
}

if (-not $Force) {
    $confirmation = Read-Host "This will restore '$backupPath' into database '$($connection.Database)'. Type YES to continue"
    if ($confirmation -ne "YES") {
        throw "Restore aborted by user."
    }
}

$previousPassword = $env:PGPASSWORD
try {
    if (-not [string]::IsNullOrWhiteSpace($connection.Password)) {
        $env:PGPASSWORD = $connection.Password
    }

    if ($restoreWithPgRestore) {
        $restoreArgs = @(
            "--host=$($connection.Host)"
            "--port=$($connection.Port)"
            "--username=$($connection.Username)"
            "--dbname=$($connection.Database)"
            "--no-owner"
            "--no-privileges"
            $backupPath
        )
        if ($DropExisting) {
            $restoreArgs = @("--clean", "--if-exists") + $restoreArgs
        }
        & $restorer @restoreArgs
        if ($LASTEXITCODE -ne 0) {
            throw "pg_restore failed with exit code $LASTEXITCODE"
        }
    }
    else {
        if ($DropExisting) {
            $preCleanSql = "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
            $preCleanArgs = @(
                "--host=$($connection.Host)"
                "--port=$($connection.Port)"
                "--username=$($connection.Username)"
                "--dbname=$($connection.Database)"
                "--set=ON_ERROR_STOP=1"
                "--command=$preCleanSql"
            )
            & $restorer @preCleanArgs
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to clean existing schema before restore. Ensure the restore user owns the target schema."
            }
        }

        $psqlArgs = @(
            "--host=$($connection.Host)"
            "--port=$($connection.Port)"
            "--username=$($connection.Username)"
            "--dbname=$($connection.Database)"
            "--set=ON_ERROR_STOP=1"
            "--file=$backupPath"
        )
        & $restorer @psqlArgs
        if ($LASTEXITCODE -ne 0) {
            throw "psql restore failed with exit code $LASTEXITCODE"
        }
    }
}
finally {
    if ($null -eq $previousPassword) {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    } else {
        $env:PGPASSWORD = $previousPassword
    }
}

Write-Host "Restore completed successfully:"
Write-Host "  Backup: $backupPath"
Write-Host "  Target database: $($connection.Database)"
