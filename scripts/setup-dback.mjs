#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to execute commands with logging and error handling
function execCommand(command, options = {}) {
  const displayCommand = options.displayCommand || command;
  console.log(`🔧 Executing: ${displayCommand}`);
  
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    return output;
  } catch (error) {
    console.error(`❌ Command failed: ${displayCommand}`);
    console.error(`   Error: ${error.message}`);
    if (error.stderr) {
      console.error(`   stderr: ${error.stderr}`);
    }
    throw error;
  }
}

// Check if Python is installed
function checkPythonInstalled() {
  console.log('🔍 Checking for Python installation...');
  
  const MIN_PYTHON_VERSION = [3, 8];
  
  // Try python first, then python3, then Windows py launcher
  const pythonCommands = ['python', 'python3', 'py -3'];
  
  for (const cmd of pythonCommands) {
    try {
      const versionOutput = execSync(`${cmd} --version`, { encoding: 'utf8', stdio: 'pipe' });
      console.log(`✅ Found ${cmd}: ${versionOutput.trim()}`);
      
      // Parse version (e.g., "Python 3.10.5" -> [3, 10, 5])
      const versionMatch = versionOutput.match(/Python (\d+)\.(\d+)\.(\d+)/);
      if (!versionMatch) {
        console.log(`⚠️  Could not parse version for ${cmd}, trying next...`);
        continue;
      }
      
      const major = parseInt(versionMatch[1], 10);
      const minor = parseInt(versionMatch[2], 10);
      
      // Check if version meets minimum requirement (>= 3.8)
      if (major < MIN_PYTHON_VERSION[0] || 
          (major === MIN_PYTHON_VERSION[0] && minor < MIN_PYTHON_VERSION[1])) {
        console.log(`⚠️  ${cmd} is version ${major}.${minor}, but >= ${MIN_PYTHON_VERSION[0]}.${MIN_PYTHON_VERSION[1]} is required, trying next...`);
        continue;
      }
      
      console.log(`✅ Version ${major}.${minor} meets minimum requirement (>= ${MIN_PYTHON_VERSION[0]}.${MIN_PYTHON_VERSION[1]})`);
      return cmd;
    } catch (error) {
      // Try next command
    }
  }
  
  console.error('❌ No suitable Python installation found');
  console.error(`   Please install Python ${MIN_PYTHON_VERSION[0]}.${MIN_PYTHON_VERSION[1]} or later from https://www.python.org/`);
  process.exit(1);
}

// Get the path to the d-back virtual environment
function getVenvPath() {
  return path.resolve(__dirname, '..', '..', 'd-back', '.venv');
}

// Get the path to Python executable inside virtual environment
function getVenvPythonPath() {
  const venvPath = getVenvPath();
  const isWindows = process.platform === 'win32';
  
  if (isWindows) {
    return path.join(venvPath, 'Scripts', 'python.exe');
  } else {
    return path.join(venvPath, 'bin', 'python');
  }
}

// Ensure virtual environment exists and is functional
function ensureVirtualEnvironment(pythonCmd) {
  const venvPath = getVenvPath();
  
  console.log('🔍 Checking virtual environment...');
  
  if (fs.existsSync(venvPath)) {
    console.log('✅ Virtual environment already exists at:', venvPath);
  } else {
    console.log('📦 Creating virtual environment at:', venvPath);
    execCommand(`${pythonCmd} -m venv "${venvPath}"`);
    console.log('✅ Virtual environment created successfully');
  }
  
  // Verify the virtual environment is functional
  const venvPython = getVenvPythonPath();
  if (!fs.existsSync(venvPython)) {
    console.error('❌ Virtual environment Python executable not found:', venvPython);
    process.exit(1);
  }
  
  console.log('✅ Virtual environment is functional');
}

// Uninstall existing d-back package
function uninstallDback() {
  console.log('🗑️  Uninstalling existing d-back package...');
  const venvPython = getVenvPythonPath();
  
  try {
    execCommand(`"${venvPython}" -m pip uninstall d-back -y`, { silent: true });
    console.log('✅ Existing package uninstalled');
  } catch (error) {
    // Package might not be installed, that's okay
    console.log('⚠️  No existing package to uninstall (or uninstall failed)');
  }
}

// Clean build artifacts
function cleanBuildArtifacts() {
  console.log('🧹 Cleaning build artifacts...');
  const dbackPath = path.resolve(__dirname, '..', '..', 'd-back');
  
  const artifactDirs = ['dist', 'build', 'd_back.egg-info'];
  
  for (const dir of artifactDirs) {
    const dirPath = path.join(dbackPath, dir);
    if (fs.existsSync(dirPath)) {
      console.log(`   Removing ${dir}/`);
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  }
  
  console.log('✅ Build artifacts cleaned');
}

// Verify installation
function verifyInstallation() {
  console.log('🔍 Verifying installation...');
  const venvPython = getVenvPythonPath();
  
  try {
    const version = execSync(`"${venvPython}" -c "import d_back; print(d_back.__version__)"`, {
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();
    
    console.log(`✅ d-back successfully installed: version ${version}`);
    return version;
  } catch (error) {
    console.error('❌ Installation verification failed');
    console.error('   Could not import d_back or read version');
    throw error;
  }
}

// Install from PyPI
function installFromPyPI(version) {
  console.log(`📦 Installing d-back version ${version} from PyPI...`);
  
  uninstallDback();
  
  const venvPython = getVenvPythonPath();
  execCommand(`"${venvPython}" -m pip install d-back==${version}`);
  
  const installedVersion = verifyInstallation();
  console.log(`🚀 PyPI installation complete! Installed version: ${installedVersion}`);
}

// Install from git commit
function installFromGitCommit(commitHash) {
  console.log(`📦 Building and installing d-back from git commit ${commitHash}...`);
  
  const dbackPath = path.resolve(__dirname, '..', '..', 'd-back');
  
  // Verify it's a git repository
  if (!fs.existsSync(path.join(dbackPath, '.git'))) {
    console.error('❌ Not a git repository:', dbackPath);
    process.exit(1);
  }
  
  // Store current branch/commit for reference
  let originalRef;
  try {
    originalRef = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: dbackPath,
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();
    console.log(`📌 Current git ref: ${originalRef}`);
  } catch (error) {
    console.log('⚠️  Could not determine current git ref');
  }
  
  // Check if user wants to keep the checkout
  const keepCheckout = process.env.DBACK_KEEP_CHECKOUT === '1';
  if (keepCheckout) {
    console.log('ℹ️  DBACK_KEEP_CHECKOUT=1: Repository will remain at checked out commit');
  }
  
  try {
    // Check if working tree is clean before checkout
    console.log('🔍 Checking git working tree status...');
    let gitStatus;
    try {
      gitStatus = execSync('git status --porcelain', {
        cwd: dbackPath,
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch (error) {
      console.error('❌ Failed to check git status');
      throw error;
    }
    
    if (gitStatus.trim().length > 0) {
      console.error('❌ Git working tree is dirty. Cannot checkout commit.');
      console.error('   The d-back repository has uncommitted changes:');
      console.error('');
      console.error(gitStatus.trim().split('\n').map(line => `   ${line}`).join('\n'));
      console.error('');
      console.error('   Please commit or stash your changes before running this script.');
      console.error(`   cd ${dbackPath} && git status`);
      process.exit(1);
    }
    
    console.log('✅ Working tree is clean');
    
    // Fetch latest changes from all remotes
    console.log('📡 Fetching latest changes from remotes...');
    try {
      execCommand('git fetch --all --tags', {
        cwd: dbackPath,
        displayCommand: 'git fetch --all --tags'
      });
      console.log('✅ Fetch complete');
    } catch (error) {
      console.error('❌ Failed to fetch from remotes');
      throw error;
    }
    
    // Validate that the commit exists
    console.log(`🔍 Validating commit ${commitHash}...`);
    try {
      execSync(`git rev-parse --verify ${commitHash}^{commit}`, {
        cwd: dbackPath,
        encoding: 'utf8',
        stdio: 'pipe'
      });
      console.log('✅ Commit exists');
    } catch (error) {
      console.error(`❌ Commit ${commitHash} not found in repository`);
      console.error('   The commit hash may be invalid or not available in any remote.');
      console.error('   Please verify the commit hash and ensure you have access to the correct remote.');
      console.error(`   cd ${dbackPath} && git log --oneline`);
      process.exit(1);
    }
    
    // Checkout the specified commit
    console.log(`🔀 Checking out commit ${commitHash}...`);
    try {
      execCommand(`git checkout ${commitHash}`, {
        cwd: dbackPath,
        displayCommand: `git checkout ${commitHash}`
      });
    } catch (error) {
      console.error('❌ Failed to checkout commit. Please verify the commit hash is valid.');
      process.exit(1);
    }
    
    uninstallDback();
    cleanBuildArtifacts();
    
    // Ensure build module is installed
    console.log('📦 Ensuring build dependencies are available...');
    const venvPython = getVenvPythonPath();
    execCommand(`"${venvPython}" -m pip install build`, { silent: true });
    
    // Build the package
    console.log('🏗️  Building package...');
    execCommand(`"${venvPython}" -m build`, { cwd: dbackPath });
    
    // Find the generated wheel file
    const distPath = path.join(dbackPath, 'dist');
    
    if (!fs.existsSync(distPath)) {
      console.error('❌ Build failed: dist/ directory was not created');
      console.error('   The build process did not produce any output files');
      process.exit(1);
    }
    
    const files = fs.readdirSync(distPath);
    const wheelFiles = files.filter(f => f.endsWith('.whl'));
    
    if (wheelFiles.length === 0) {
      console.error('❌ No wheel file found in dist/ directory');
      process.exit(1);
    }
    
    // Sort wheel files by modification time (newest first)
    wheelFiles.sort((a, b) => {
      const aPath = path.join(distPath, a);
      const bPath = path.join(distPath, b);
      const aStat = fs.statSync(aPath);
      const bStat = fs.statSync(bPath);
      return bStat.mtime.getTime() - aStat.mtime.getTime();
    });
    
    // Pick the newest wheel file
    const wheelFile = wheelFiles[0];
    const wheelPath = path.join(distPath, wheelFile);
    console.log(`📦 Found wheel file: ${wheelFile}`);
    
    if (wheelFiles.length > 1) {
      console.log(`⚠️  Multiple wheel files found, using newest: ${wheelFile}`);
    }  
    // Install the wheel file
    console.log('📦 Installing wheel file...');
    execCommand(`"${venvPython}" -m pip install "${wheelPath}" --force-reinstall`);
    
    const installedVersion = verifyInstallation();
    console.log(`🚀 Git commit installation complete! Installed version: ${installedVersion}`);
    
  } finally {
    // Restore original git ref unless user opted to keep the checkout
    if (originalRef && !keepCheckout) {
      console.log(`� Restoring original git ref: ${originalRef}`);
      try {
        execCommand(`git checkout ${originalRef}`, {
          cwd: dbackPath,
          displayCommand: `git checkout ${originalRef}`
        });
        console.log('✅ Repository restored to original ref');
      } catch (error) {
        console.error(`⚠️  Failed to restore original ref: ${originalRef}`);
        console.error(`   You may need to manually restore: cd ${dbackPath} && git checkout ${originalRef}`);
      }
    } else if (originalRef && keepCheckout) {
      console.log(`📌 Repository remains at commit ${commitHash} (DBACK_KEEP_CHECKOUT=1)`);
      console.log(`   To restore: cd ${dbackPath} && git checkout ${originalRef}`);
    }
  }
}

// Main execution
function main() {
  console.log('🚀 d-back Setup Script\n');
  
  // Check installation mode
  const dbackVersion = process.env.DBACK_VERSION;
  const dbackCommit = process.env.DBACK_COMMIT;
  
  if (dbackVersion && dbackCommit) {
    console.error('❌ Error: Both DBACK_VERSION and DBACK_COMMIT are set');
    console.error('   Please set only one of these environment variables');
    console.error('');
    console.error('   Usage:');
    console.error('   - PyPI mode:       DBACK_VERSION=1.0.0 node scripts/setup-dback.mjs');
    console.error('   - Git commit mode: DBACK_COMMIT=abc123 node scripts/setup-dback.mjs');
    process.exit(1);
  }
  
  if (!dbackVersion && !dbackCommit) {
    console.error('❌ Error: Neither DBACK_VERSION nor DBACK_COMMIT is set');
    console.error('   Please set one of these environment variables');
    console.error('');
    console.error('   Usage:');
    console.error('   - PyPI mode:       DBACK_VERSION=1.0.0 node scripts/setup-dback.mjs');
    console.error('   - Git commit mode: DBACK_COMMIT=abc123 node scripts/setup-dback.mjs');
    process.exit(1);
  }
  
  try {
    // Check Python installation
    const pythonCmd = checkPythonInstalled();
    
    // Ensure virtual environment exists
    ensureVirtualEnvironment(pythonCmd);
    
    // Install based on mode
    if (dbackVersion) {
      installFromPyPI(dbackVersion);
    } else {
      installFromGitCommit(dbackCommit);
    }
    
    console.log('\n✅ Setup complete!');
    
  } catch (error) {
    console.error('\n❌ Setup failed!');
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the script
main();
