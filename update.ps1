$ErrorActionPreference = "Stop"

# ============================================================
# Sonic Topography Enhanced v2
# Update -> Build -> Verify -> Deploy
# ============================================================

# CHANGE THIS to your Wallpaper Engine local project directory.
# Example:
# $WE = "C:\Program Files (x86)\Steam\steamapps\common\wallpaper_engine\projects\myprojects\sonic-topography-enhanced"
$WE = "<SET_WALLPAPER_ENGINE_PROJECT_PATH_HERE>"

$Branch = "enhanced-audio-v2"
$BuildDir = ".\dist-wallpaper"
$ProjectFile = Join-Path $BuildDir "project.json"
$Vite = ".\node_modules\.bin\vite.cmd"

if ($WE -eq "<SET_WALLPAPER_ENGINE_PROJECT_PATH_HERE>" -or [string]::IsNullOrWhiteSpace($WE)) {
    throw "Set the `$WE variable at the top of update.ps1 to your Wallpaper Engine project directory first."
}

Write-Host "`n[1/6] Updating $Branch..." -ForegroundColor Cyan

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

Write-Host "`n[2/6] Cleaning old build..." -ForegroundColor Cyan

if (Test-Path $BuildDir) {
    Remove-Item $BuildDir -Recurse -Force
}

Write-Host "`n[3/6] Building Wallpaper Engine package..." -ForegroundColor Cyan

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

Write-Host "`n[4/6] Verifying generated project..." -ForegroundColor Cyan

$Project = Get-Content $ProjectFile -Raw | ConvertFrom-Json
$P = $Project.general.properties

Write-Host "Name:    $($Project.name)"
Write-Host "Title:   $($Project.title)"
Write-Host "Version: $($Project.version)"

if ($Project.name -ne "Sonic Topography Enhanced v2") {
    throw "Unexpected generated project name: $($Project.name)"
}

if ($Project.workshopid) {
    throw "The generated project still contains the upstream Workshop ID."
}

$RequiredProperties = @(
    "rhythmSyncEnabled",
    "beatTriggerStrength",
    "topAccentEnabled",
    "topAccentTrigger",
    "topAccentColorMode",
    "topAccentCustomColor",
    "topAccentDensity",
    "topAccentIntensity",
    "visualAttackMs",
    "visualReleaseMs",
    "spectralMemoryEnabled",
    "spectralMemoryStrength",
    "stereoSpatialEnabled",
    "stereoSpatialStrength",
    "terrainCoherenceEnabled",
    "terrainCoherenceStrength",
    "membraneEnabled",
    "membraneStrength"
)

foreach ($Name in $RequiredProperties) {
    if ($null -eq $P.$Name) {
        throw "Enhanced v2 property is missing: $Name"
    }
    Write-Host "  OK: $Name" -ForegroundColor Green
}

# The old white sparkle system has intentionally been replaced by Music Top Accents.
if ($null -ne $P.sparkleIntensity) {
    Write-Warning "Legacy sparkleIntensity is still present in generated project.json."
} else {
    Write-Host "  OK: legacy Sparkle Intensity removed" -ForegroundColor Green
}

$JsonText = Get-Content $ProjectFile -Raw
if ($JsonText -match '[\u3400-\u9fff]') {
    Write-Warning "Chinese characters remain somewhere in generated project.json."
} else {
    Write-Host "  OK: generated UI text is English-only" -ForegroundColor Green
}

Write-Host "`n[5/6] Deploying to Wallpaper Engine..." -ForegroundColor Cyan

if (Test-Path $WE) {
    Remove-Item $WE -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $WE | Out-Null
Copy-Item "$BuildDir\*" -Destination $WE -Recurse -Force

Write-Host "`n[6/6] Verifying deployed files..." -ForegroundColor Cyan

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
