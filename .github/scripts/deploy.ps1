# ============================================================================
# D-Zone Deployment Build Script
# ============================================================================
#
# Description:
#   This script replicates the "Build for production" step from the GitHub 
#   Actions deploy.yml workflow. It builds the D-Zone application for 
#   deployment with versioned hash-based routing.
#
# Usage:
#   .\deploy.ps1 -Version "1.0.0"
#   .\.github\scripts\deploy.ps1 -Version "test-build"
#
# Parameters:
#   -Version: Required. The version identifier for this deployment build.
#             This will be used as the folder name and default version.
#
# Output:
#   Creates a 'build' directory structure:
#   - build/index.html (root router with hash-based routing)
#   - build/{version}/ (versioned application files)
#
# Examples:
#   .\deploy.ps1 -Version "1.0.0"
#   .\deploy.ps1 -Version "feature-test"
#   .\deploy.ps1 -Version "2024-10-11-hotfix"
#
# ============================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

# ============================================================================
# PREPARATION - Static Variables
# ============================================================================

# Calculate absolute paths using script location
$ScriptDir = $PSScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$BuildDir = Join-Path $RepoRoot "build"
$VersionDir = Join-Path $BuildDir $Version
$DistDir = Join-Path $RepoRoot "dist"
$IndexHtmlPath = Join-Path $BuildDir "index.html"

# Script configuration
$ErrorActionPreference = "Stop"

# ============================================================================
# FUNCTIONS - Grouped by Task
# ============================================================================

function Write-ScriptHeader {
    param([string]$Version)
    
    Write-Host "============================================================================" -ForegroundColor Magenta
    Write-Host "D-Zone Deployment Build Script" -ForegroundColor Magenta
    Write-Host "============================================================================" -ForegroundColor Magenta
    Write-Host "Version: $Version" -ForegroundColor Green
    Write-Host "Repository Root: $RepoRoot" -ForegroundColor Yellow
    Write-Host "Build Directory: $BuildDir" -ForegroundColor Yellow
    Write-Host "Working Directory: $(Get-Location)" -ForegroundColor Yellow
    Write-Host ""
}

function Initialize-BuildEnvironment {
    Write-Host "Setting up build environment..." -ForegroundColor Cyan
    
    # Change to repository root directory
    Set-Location $RepoRoot
    Write-Host "✓ Changed to repository root: $RepoRoot" -ForegroundColor Green
    
    # Clean and create build directory structure
    if (Test-Path $BuildDir) {
        Write-Host "Cleaning existing build directory..." -ForegroundColor Yellow
        Remove-Item $BuildDir -Recurse -Force
    }
    
    New-Item -ItemType Directory -Path $VersionDir -Force | Out-Null
    Write-Host "✓ Created build directory structure" -ForegroundColor Green
}

function Invoke-ProductionBuild {
    Write-Host "Running production build..." -ForegroundColor Cyan
    
    try {
        npm run build:prod
        if ($LASTEXITCODE -ne 0) {
            throw "npm run build:prod exited with code $LASTEXITCODE"
        }
        Write-Host "✓ Production build completed successfully" -ForegroundColor Green
    }
    catch {
        Write-Error "Production build failed: $_"
        exit 1
    }
}

function Copy-DistFiles {
    Write-Host "Copying distribution files..." -ForegroundColor Cyan
    
    if (-not (Test-Path $DistDir)) {
        Write-Error "Distribution directory not found at: $DistDir"
        exit 1
    }
    
    try {
        $DistItems = Get-ChildItem -Path $DistDir -Recurse
        if ($DistItems.Count -eq 0) {
            Write-Error "Distribution directory is empty: $DistDir"
            exit 1
        }
        
        Copy-Item -Path "$DistDir\*" -Destination $VersionDir -Recurse -Force
        Write-Host "✓ Copied $($DistItems.Count) items from dist to version directory" -ForegroundColor Green
    }
    catch {
        Write-Error "Failed to copy distribution files: $_"
        exit 1
    }
}

function New-IndexHtmlContent {
    param([string]$Version)
    
    return @"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>D-Zone</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #181213;
      color: white;
      font-family: Arial, sans-serif;
    }
    #loading {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
    }
    #content {
      width: 100vw;
      height: 100vh;
      border: none;
      display: none;
    }
    .version-info {
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0,0,0,0.7);
      padding: 5px 10px;
      border-radius: 5px;
      font-size: 12px;
      z-index: 1000;
    }
  </style>
</head>
<body>
  <div id="loading">
    <div>Loading D-Zone...</div>
    <div id="version-display"></div>
  </div>
  <div class="version-info" id="version-info" style="display: none;"></div>
  <iframe id="content" src=""></iframe>

  <script>
    const DEFAULT_VERSION = '$Version';
    
    // Get current version from hash or use default
    function getCurrentVersion() {
      const hash = window.location.hash.slice(1); // Remove #
      return hash || DEFAULT_VERSION;
    }
    
    // Update the hash without triggering page reload
    function setVersion(version) {
      if (window.location.hash.slice(1) !== version) {
        window.location.hash = version;
      }
    }
    
    // Load version content
    function loadVersion(version, preserveSocketURL = false) {
      const versionDisplay = document.getElementById('version-display');
      const versionInfo = document.getElementById('version-info');
      const content = document.getElementById('content');
      const loading = document.getElementById('loading');
      
      versionDisplay.textContent = `Version: `${version}`;
      versionInfo.textContent = `v`${version}`;
      
      // Build the URL for the versioned content
      let contentUrl = `${version}/`;
      
      // Preserve socketURL parameter if present and requested
      const urlParams = new URLSearchParams(window.location.search);
      const socketURL = urlParams.get('socketURL');
      if (socketURL && preserveSocketURL) {
        contentUrl += `?socketURL=`${encodeURIComponent(socketURL)}`;
      }
      
      // Load content in iframe
      content.src = contentUrl;
      
      // Show loading state
      loading.style.display = 'block';
      content.style.display = 'none';
      versionInfo.style.display = 'none';
      
      // Handle iframe load
      content.onload = function() {
        loading.style.display = 'none';
        content.style.display = 'block';
        versionInfo.style.display = 'block';
      };
      
      // Handle iframe error
      content.onerror = function() {
        loading.innerHTML = `
          <div>Error loading version `${version}`</div>
          <div>Please check if this version exists</div>
        `;
      };
    }
    
    // Handle hash changes (for manual navigation or back/forward)
    function handleHashChange() {
      const version = getCurrentVersion();
      loadVersion(version, true);
    }
    
    // Initialize routing
    function initializeRouting() {
      const currentVersion = getCurrentVersion();
      
      // If no hash, set default version
      if (!window.location.hash) {
        setVersion(DEFAULT_VERSION);
      }
      
      // Load the current version
      loadVersion(currentVersion, true);
      
      // Listen for hash changes
      window.addEventListener('hashchange', handleHashChange);
    }
    
    // Start the application
    document.addEventListener('DOMContentLoaded', initializeRouting);
    
    // Expose version switching function globally (for potential external use)
    window.switchToVersion = function(version) {
      setVersion(version);
      loadVersion(version, true);
    };
  </script>
</body>
</html>
"@
}

function New-RootIndexHtml {
    param([string]$Version)
    
    Write-Host "Creating root index.html with hash-based routing..." -ForegroundColor Cyan
    
    try {
        $IndexContent = New-IndexHtmlContent -Version $Version
        $IndexContent | Out-File -FilePath $IndexHtmlPath -Encoding UTF8 -NoNewline
        
        $IndexSize = (Get-Item $IndexHtmlPath).Length
        Write-Host "✓ Created root index.html ($IndexSize bytes) with version $Version" -ForegroundColor Green
    }
    catch {
        Write-Error "Failed to create root index.html: $_"
        exit 1
    }
}

function Write-BuildSummary {
    param([string]$Version)
    
    Write-Host "`n============================================================================" -ForegroundColor Magenta
    Write-Host "BUILD SUMMARY" -ForegroundColor Magenta
    Write-Host "============================================================================" -ForegroundColor Magenta
    
    Write-Host "Version: $Version" -ForegroundColor White
    Write-Host "Build directory: $BuildDir" -ForegroundColor White
    Write-Host "Version directory: $VersionDir" -ForegroundColor White
    
    if (Test-Path $VersionDir) {
        $VersionFiles = Get-ChildItem $VersionDir -Recurse | Measure-Object
        Write-Host "Files in version directory: $($VersionFiles.Count)" -ForegroundColor White
    }
    
    if (Test-Path $IndexHtmlPath) {
        $IndexSize = (Get-Item $IndexHtmlPath).Length
        Write-Host "Root index.html size: $IndexSize bytes" -ForegroundColor White
    }
}

function Write-NextSteps {
    Write-Host "`n============================================================================" -ForegroundColor Magenta
    Write-Host "NEXT STEPS" -ForegroundColor Magenta
    Write-Host "============================================================================" -ForegroundColor Magenta
    
    Write-Host "1. Serve the build directory with a local web server" -ForegroundColor Yellow
    Write-Host "2. Test the hash-based routing by navigating to different versions" -ForegroundColor Yellow
    Write-Host "3. Example commands to serve locally:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   # Using Node.js serve" -ForegroundColor Cyan
    Write-Host "   npx serve `"$BuildDir`" -p 8080" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   # Using Python" -ForegroundColor Cyan
    Write-Host "   python -m http.server 8080 --directory `"$BuildDir`"" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "   # Using PHP" -ForegroundColor Cyan
    Write-Host "   php -S localhost:8080 -t `"$BuildDir`"" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "4. Test URLs:" -ForegroundColor Yellow
    Write-Host "   - Default version: http://localhost:8080" -ForegroundColor Cyan
    Write-Host "   - Specific version: http://localhost:8080#$Version" -ForegroundColor Cyan
    Write-Host ""
}

# ============================================================================
# SCRIPT - Main Execution
# ============================================================================

try {
    # Display script header
    Write-ScriptHeader -Version $Version
    
    # Initialize build environment
    Initialize-BuildEnvironment
    
    # Run production build
    Invoke-ProductionBuild
    
    # Copy distribution files to version directory
    Copy-DistFiles
    
    # Create root index.html with hash-based routing
    New-RootIndexHtml -Version $Version
    
    # Display build summary
    Write-BuildSummary -Version $Version
    
    # Show next steps
    Write-NextSteps
    
    Write-Host "Build completed successfully! 🚀" -ForegroundColor Green
}
catch {
    Write-Host "`n❌ BUILD FAILED" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}