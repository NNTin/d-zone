# PowerShell script to simulate the "Build for production" step from deploy.yml
# Usage: .\deploy.ps1 -Version "1.0.0"

param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

Write-Host "Starting local deployment build for version: $Version" -ForegroundColor Green

# Set working directory to repository root
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $RepoRoot

Write-Host "Working directory: $(Get-Location)" -ForegroundColor Yellow

# Create build directory structure
Write-Host "Creating build directory structure..." -ForegroundColor Cyan
$BuildDir = "build"
$VersionDir = "$BuildDir/$Version"

if (Test-Path $BuildDir) {
    Write-Host "Cleaning existing build directory..." -ForegroundColor Yellow
    Remove-Item $BuildDir -Recurse -Force
}

New-Item -ItemType Directory -Path $VersionDir -Force | Out-Null

# Run production build
Write-Host "Running production build..." -ForegroundColor Cyan
npm run build:prod

if ($LASTEXITCODE -ne 0) {
    Write-Error "Production build failed!"
    exit 1
}

# Copy dist files to version directory
Write-Host "Copying dist files to version directory..." -ForegroundColor Cyan
if (Test-Path "dist") {
    Copy-Item -Path "dist\*" -Destination $VersionDir -Recurse -Force
    Write-Host "✓ Copied dist files to $VersionDir" -ForegroundColor Green
} else {
    Write-Error "dist directory not found! Build may have failed."
    exit 1
}

# Create root index.html with hash-based routing
Write-Host "Creating root index.html..." -ForegroundColor Cyan
$IndexHtml = @"
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
    const DEFAULT_VERSION = 'VERSION_PLACEHOLDER';
    
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
      
      versionDisplay.textContent = `Version: $${version}`;
      versionInfo.textContent = `v$${version}`;
      
      // Build the URL for the versioned content
      let contentUrl = `$${version}/`;
      
      // Preserve socketURL parameter if present and requested
      const urlParams = new URLSearchParams(window.location.search);
      const socketURL = urlParams.get('socketURL');
      if (socketURL && preserveSocketURL) {
        contentUrl += `?socketURL=$${encodeURIComponent(socketURL)}`;
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
          <div>Error loading version $${version}</div>
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

# Write the HTML content to file
$IndexHtml | Out-File -FilePath "$BuildDir\index.html" -Encoding UTF8

# Replace the placeholder with actual version
Write-Host "Replacing version placeholder..." -ForegroundColor Cyan
$IndexContent = Get-Content "$BuildDir\index.html" -Raw
$IndexContent = $IndexContent -replace 'VERSION_PLACEHOLDER', $Version
$IndexContent | Out-File -FilePath "$BuildDir\index.html" -Encoding UTF8 -NoNewline

Write-Host "✓ Created root index.html with version $Version" -ForegroundColor Green

# Display build summary
Write-Host "`n=== Build Summary ===" -ForegroundColor Magenta
Write-Host "Version: $Version" -ForegroundColor White
Write-Host "Build directory: $BuildDir" -ForegroundColor White
Write-Host "Version directory: $VersionDir" -ForegroundColor White

if (Test-Path $VersionDir) {
    $VersionFiles = Get-ChildItem $VersionDir -Recurse | Measure-Object
    Write-Host "Files in version directory: $($VersionFiles.Count)" -ForegroundColor White
}

if (Test-Path "$BuildDir\index.html") {
    $IndexSize = (Get-Item "$BuildDir\index.html").Length
    Write-Host "Root index.html size: $IndexSize bytes" -ForegroundColor White
}

Write-Host "`n=== Next Steps ===" -ForegroundColor Magenta
Write-Host "1. Serve the build directory with a local web server" -ForegroundColor Yellow
Write-Host "2. Test the hash-based routing by navigating to different versions" -ForegroundColor Yellow
Write-Host "3. Example commands to serve locally:" -ForegroundColor Yellow
Write-Host "   - Python: python -m http.server 8080 --directory build" -ForegroundColor Cyan
Write-Host "   - Node.js: npx serve build -p 8080" -ForegroundColor Cyan
Write-Host "   - PHP: php -S localhost:8080 -t build" -ForegroundColor Cyan

Write-Host "`nBuild completed successfully! 🚀" -ForegroundColor Green