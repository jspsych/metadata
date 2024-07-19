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

// Browser minified build configuration
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.browser.min.js',
  platform: 'browser',
  minify: true,
  alias: {
    'csv-parse': 'csv-parse/browser/esm',
  },
});

// Node build configuration
await esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  platform: 'node',
  bundle: true,
  format: 'esm',
  external: ['csv-parse'],
});