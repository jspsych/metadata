import * as esbuild from 'esbuild';

// Browser build configuration
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.browser.js',
  platform: 'browser',
  alias: {
    'csv-parse': 'csv-parse/browser/esm',
  },
});

// Node build configuration
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.js',
  platform: 'node',
});