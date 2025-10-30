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
  
  // Try python first, then python3
  const pythonCommands = ['python', 'python3'];
  
  for (const cmd of pythonCommands) {
    try {
      const version = execSync(`${cmd} --version`, { encoding: 'utf8', stdio: 'pipe' });
      console.log(`✅ Found ${cmd}: ${version.trim()}`);
      return cmd;
    } catch (error) {
      // Try next command
    }
  }
  
  console.error('❌ Python is not installed or not in PATH');
  console.error('   Please install Python 3.8 or later from https://www.python.org/');
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

// Get the path to pip inside virtual environment
function getVenvPipPath() {
  const venvPath = getVenvPath();
  const isWindows = process.platform === 'win32';
  
  if (isWindows) {
    return path.join(venvPath, 'Scripts', 'pip.exe');
  } else {
    return path.join(venvPath, 'bin', 'pip');
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
  const venvPip = getVenvPipPath();
  
  try {
    execCommand(`"${venvPip}" uninstall d_back -y`, { silent: true });
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
  
  const venvPip = getVenvPipPath();
  execCommand(`"${venvPip}" install d_back==${version}`);
  
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
  const venvPip = getVenvPipPath();
  execCommand(`"${venvPip}" install build`, { silent: true });
  
  // Build the package
  console.log('🏗️  Building package...');
  const venvPython = getVenvPythonPath();
  execCommand(`"${venvPython}" -m build`, { cwd: dbackPath });
  
  // Find the generated wheel file
  const distPath = path.join(dbackPath, 'dist');
  const files = fs.readdirSync(distPath);
  const wheelFile = files.find(f => f.endsWith('.whl'));
  
  if (!wheelFile) {
    console.error('❌ No wheel file found in dist/ directory');
    process.exit(1);
  }
  
  const wheelPath = path.join(distPath, wheelFile);
  console.log(`📦 Found wheel file: ${wheelFile}`);
  
  // Install the wheel file
  console.log('📦 Installing wheel file...');
  execCommand(`"${venvPip}" install "${wheelPath}" --force-reinstall`);
  
  const installedVersion = verifyInstallation();
  console.log(`🚀 Git commit installation complete! Installed version: ${installedVersion}`);
  
  if (originalRef) {
    console.log(`📌 Note: Git repository is now at commit ${commitHash}`);
    console.log(`   To restore: cd ../d-back && git checkout ${originalRef}`);
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
