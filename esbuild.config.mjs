/**
 * esbuild configuration
 * 
 * When E2E_MODE environment variable is set, adds test mode banner.
 */

import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');
const isE2E = process.env.E2E_MODE === 'true';

const config = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  sourcemap: true,
  outfile: 'dist/static/bundle.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  define: {
    'global': 'window'
  },
  external: ['fs', 'path'],
  // Add E2E banner when in test mode
  banner: isE2E ? {
    js: `
// E2E Testing Mode - Modules exposed for mocking
window.__E2E_TEST_MODE = true;
console.log('🧪 E2E Test Mode: Modules will be exposed via window.__testModules');
`
  } : undefined,
  minify: process.env.NODE_ENV === 'production',
};

if (isWatch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log(`👀 Watching for changes... ${isE2E ? '(E2E Mode)' : ''}`);
} else {
  await esbuild.build(config);
  console.log(`✅ Build complete ${isE2E ? '(E2E Mode)' : ''}`);
}
