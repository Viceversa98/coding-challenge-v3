# Start the database, API, and UI.
# Usage: .\dev.ps1
# Leaves existing data in place. It only starts Postgres and applies migrations.

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

function Test-Listening {
  param([int]$Port)
  $pattern = ":$Port\s+\S+\s+LISTENING"
  return [bool](netstat -ano | Select-String -Pattern $pattern)
}

function Get-Runner {
  if (Get-Command bun -ErrorAction SilentlyContinue) {
    return "bun"
  }
  if (Get-Command npm -ErrorAction SilentlyContinue) {
    return "npm"
  }
  throw "Install Bun or Node.js before running this script."
}

function Invoke-Compose {
  param([string[]]$ComposeArgs)
  if (Get-Command docker -ErrorAction SilentlyContinue) {
    & docker compose @ComposeArgs
  } elseif (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    & docker-compose @ComposeArgs
  } else {
    throw "Docker is not available. Open Docker Desktop, then run this script again."
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Docker command failed. Open Docker Desktop, then run this script again."
  }
}

Write-Host "Starting Postgres..."
Push-Location (Join-Path $Root "database")
try {
  Invoke-Compose -ComposeArgs @("up", "-d", "postgres")
  Write-Host "Applying database migrations..."
  Invoke-Compose -ComposeArgs @("run", "--rm", "flyway")
} finally {
  Pop-Location
}

$runner = Get-Runner

function Start-App {
  param(
    [string]$Name,
    [string]$Directory,
    [int]$Port
  )
  if (Test-Listening $Port) {
    Write-Host "$Name is already running on port $Port."
    return
  }
  if (-not (Test-Path (Join-Path $Directory "node_modules"))) {
    Write-Host "Installing $Name dependencies..."
    Push-Location $Directory
    try {
      & $runner install
      if ($LASTEXITCODE -ne 0) {
        throw "$Name dependency install failed."
      }
    } finally {
      Pop-Location
    }
  }
  Start-Process -FilePath "powershell" -WorkingDirectory $Directory -ArgumentList @(
    "-NoExit",
    "-Command",
    "& $runner run dev"
  )
  Write-Host "Started $Name in a new window ($runner run dev)."
}

Start-App -Name "API" -Directory (Join-Path $Root "aggregator-job") -Port 3000
Start-App -Name "UI" -Directory (Join-Path $Root "web") -Port 5173

Write-Host "UI:  http://localhost:5173"
Write-Host "API: http://localhost:3000"
