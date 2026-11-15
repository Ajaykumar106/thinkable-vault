# Thinkable Vault — Release Keystore & Build Helper Script
# Run in PowerShell: .\build-release.ps1

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Thinkable Vault — Google Play Release Build Preparation  " -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

$keystorePath = Join-Path $PSScriptRoot "thinkable-release.jks"

# Locate keytool if not in PATH
$keytool = Get-Command keytool -ErrorAction SilentlyContinue
if (-not $keytool) {
    $searchPaths = @(
        "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe",
        "C:\Program Files\Android\Android Studio\jre\bin\keytool.exe",
        "C:\Program Files\Java\jdk*\bin\keytool.exe",
        "$env:LOCALAPPDATA\Android\Sdk\*\keytool.exe"
    )
    foreach ($pattern in $searchPaths) {
        $found = Get-Item $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) {
            $keytool = $found.FullName
            break
        }
    }
}

if (Test-Path $keystorePath) {
    Write-Host "[✓] Release keystore already exists:" -ForegroundColor Green
    Write-Host "    $keystorePath`n"
} else {
    if ($keytool) {
        Write-Host "[*] Generating production release keystore..." -ForegroundColor Yellow
        & $keytool -genkey -v -keystore $keystorePath -keyalg RSA -keysize 2048 -validity 10000 -alias thinkable `
            -dname "CN=Thinkable Vault, OU=Mobile, O=Thinkable, L=Bangalore, ST=Karnataka, C=IN" `
            -storepass "Thinkable@2026" -keypass "Thinkable@2026"
        Write-Host "[✓] Keystore generated successfully: $keystorePath`n" -ForegroundColor Green
    } else {
        Write-Host "[!] keytool not found in PATH." -ForegroundColor Yellow
        Write-Host "    To generate your keystore, open Android Studio:" -ForegroundColor Gray
        Write-Host "    1. Open folder: $PSScriptRoot\android" -ForegroundColor Gray
        Write-Host "    2. Click: Build -> Generate Signed Bundle / APK -> Android App Bundle" -ForegroundColor Gray
        Write-Host "    3. Click 'Create new...' under Key store path" -ForegroundColor Gray
        Write-Host "    4. Save as 'thinkable-release.jks' inside the project directory.`n" -ForegroundColor Gray
    }
}

Write-Host "── Build Instructions for Google Play (.aab) ──" -ForegroundColor Cyan
Write-Host "1. Open Android Studio."
Write-Host "2. Select 'Open' and choose folder: $PSScriptRoot\android"
Write-Host "3. Let Gradle complete sync."
Write-Host "4. Go to: Build -> Generate Signed Bundle / APK -> Android App Bundle (.aab)"
Write-Host "5. Choose 'release' variant and select $keystorePath"
Write-Host "6. The output file (app-release.aab) will be created in android/app/release/"
Write-Host "7. Upload app-release.aab to Google Play Console -> Production / Internal Testing track."
Write-Host "`nAll done! See STORE_LISTING_KIT.md for store descriptions & Data Safety answers." -ForegroundColor Green
