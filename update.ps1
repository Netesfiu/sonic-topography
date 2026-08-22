$ErrorActionPreference = "Stop"

# ============================================================
# Sonic Topography
# Update -> Build -> Finalize settings -> Verify -> Deploy
# ============================================================

$RepoRoot = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = (Get-Location).Path
}
Set-Location $RepoRoot

# Local machine configuration lives in .env, which is gitignored.
# Create it once from .env.example and keep update.ps1 unmodified.
$EnvFile = Join-Path $RepoRoot ".env"

if (!(Test-Path $EnvFile)) {
    throw "Missing .env. Copy .env.example to .env and set WE to your Wallpaper Engine project directory."
}

$EnvValues = @{}
foreach ($Line in Get-Content $EnvFile) {
    $Trimmed = $Line.Trim()

    if ([string]::IsNullOrWhiteSpace($Trimmed) -or $Trimmed.StartsWith("#")) {
        continue
    }

    $Parts = $Trimmed -split "=", 2
    if ($Parts.Count -ne 2) {
        throw "Invalid .env line: $Line"
    }

    $Key = $Parts[0].Trim()
    $Value = $Parts[1].Trim()

    if (
        $Value.Length -ge 2 -and
        (($Value.StartsWith('"') -and $Value.EndsWith('"')) -or
         ($Value.StartsWith("'") -and $Value.EndsWith("'")))
    ) {
        $Value = $Value.Substring(1, $Value.Length - 2)
    }

    $EnvValues[$Key] = $Value
}

$WE = $EnvValues["WE"]
if ([string]::IsNullOrWhiteSpace($WE)) {
    throw "WE is missing from .env. Add: WE=C:\path\to\wallpaper_engine\projects\myprojects\sonic-topography"
}

$WE = [Environment]::ExpandEnvironmentVariables($WE)

$Branch = "enhanced-audio-v2"
$BuildDir = ".\dist-wallpaper"
$ProjectFile = Join-Path $BuildDir "project.json"
$Vite = ".\node_modules\.bin\vite.cmd"
$Finalizer = ".\scripts\finalize-wallpaper-project.mjs"

Write-Host "`nWallpaper Engine target:" -ForegroundColor Yellow
Write-Host $WE

Write-Host "`n[1/7] Updating $Branch..." -ForegroundColor Cyan

git switch $Branch
if ($LASTEXITCODE -ne 0) {
    throw "Could not switch to $Branch."
}

git pull --ff-only origin $Branch
if ($LASTEXITCODE -ne 0) {
    throw "Git pull failed. Check for local changes or resolve the repository state first."
}

Write-Host "`nCurrent commit:" -ForegroundColor Yellow
git log -1 --oneline

Write-Host "`n[2/7] Cleaning old build..." -ForegroundColor Cyan

if (Test-Path $BuildDir) {
    Remove-Item $BuildDir -Recurse -Force
}

Write-Host "`n[3/7] Building Wallpaper Engine package..." -ForegroundColor Cyan

if (!(Test-Path $Vite)) {
    throw "Vite was not found at $Vite. Install the project dependencies first."
}

& $Vite build --config vite.wallpaper.config.ts
if ($LASTEXITCODE -ne 0) {
    throw "Vite build failed."
}

if (!(Test-Path (Join-Path $BuildDir "index.html"))) {
    throw "Build completed, but dist-wallpaper\index.html was not found."
}

if (!(Test-Path $ProjectFile)) {
    throw "Build completed, but dist-wallpaper\project.json was not found."
}

Write-Host "`n[4/7] Finalizing original-layout settings panel..." -ForegroundColor Cyan

if (!(Test-Path $Finalizer)) {
    throw "Settings finalizer was not found at $Finalizer."
}

node $Finalizer $BuildDir
if ($LASTEXITCODE -ne 0) {
    throw "Settings finalization failed."
}

Write-Host "`n[5/7] Verifying generated project..." -ForegroundColor Cyan

$Project = Get-Content $ProjectFile -Raw | ConvertFrom-Json
$P = $Project.general.properties

Write-Host "Name:    $($Project.name)"
Write-Host "Title:   $($Project.title)"
Write-Host "Version: $($Project.version)"

if ($Project.name -ne "Sonic Topography") {
    throw "Unexpected generated project name: $($Project.name)"
}

if ($Project.workshopid) {
    throw "The generated project still contains the upstream Workshop ID."
}

# Fine-grained controls remain available, but are distributed into the original
# Appearance, Audio Response and Effect-Ripple sections.
$RequiredProperties = @(
    "topAccentEnabled",
    "topAccentTrigger",
    "topAccentColorMode",
    "topAccentCustomColor",
    "topAccentDensity",
    "topAccentIntensity",
    "visualAttackMs",
    "visualReleaseMs",
    "stereoSpatialEnabled",
    "stereoSpatialStrength",
    "spectralMemoryEnabled",
    "spectralMemoryStrength",
    "terrainCoherenceEnabled",
    "terrainCoherenceStrength",
    "rhythmSyncEnabled",
    "beatTriggerStrength"
)

foreach ($Name in $RequiredProperties) {
    if ($null -eq $P.$Name) {
        throw "Required user-facing property is missing: $Name"
    }
    Write-Host "  OK: $Name" -ForegroundColor Green
}

# Temporary/legacy settings and the discarded membrane feature must not appear.
$RemovedProperties = @(
    "sep_enhanced_audio",
    "sep_enhanced_audio_title",
    "sep_top_accent",
    "sep_top_accent_title",
    "sparkleIntensity",
    "membraneEnabled",
    "membraneStrength"
)

foreach ($Name in $RemovedProperties) {
    if ($null -ne $P.$Name) {
        throw "Removed property should not be user-facing: $Name"
    }
}

Write-Host "  OK: no Enhanced/v2 settings section" -ForegroundColor Green
Write-Host "  OK: legacy Sparkle Intensity removed" -ForegroundColor Green
Write-Host "  OK: rubber membrane feature removed" -ForegroundColor Green

$JsonText = Get-Content $ProjectFile -Raw
if ($JsonText -match '[\u3400-\u9fff]') {
    Write-Warning "Chinese characters remain somewhere in generated project.json."
} else {
    Write-Host "  OK: generated UI text is English-only" -ForegroundColor Green
}

Write-Host "`n[6/7] Deploying to Wallpaper Engine..." -ForegroundColor Cyan

if (Test-Path $WE) {
    Remove-Item $WE -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $WE | Out-Null
Copy-Item "$BuildDir\*" -Destination $WE -Recurse -Force

Write-Host "`n[7/7] Verifying deployed files..." -ForegroundColor Cyan

$InstalledProject = Join-Path $WE "project.json"
$InstalledIndex = Join-Path $WE "index.html"

if (!(Test-Path $InstalledProject)) {
    throw "Deployed project.json was not found at $InstalledProject"
}

if (!(Test-Path $InstalledIndex)) {
    throw "Deployed index.html was not found at $InstalledIndex"
}

$BuildHash = (Get-FileHash $ProjectFile).Hash
$DeployHash = (Get-FileHash $InstalledProject).Hash

if ($BuildHash -ne $DeployHash) {
    throw "Installed project.json does not match the build output."
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " BUILD + DEPLOY COMPLETE" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Installed to:" -ForegroundColor Yellow
Write-Host $WE
Write-Host ""
Write-Host "Fully restart Wallpaper Engine to load the new build."
