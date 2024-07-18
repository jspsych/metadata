import * as esbuild from 'esbuild';

// Browser build configuration
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.browser.js',
  platform: 'browser',
  define: {
    'process.env.TARGET': '"browser"'
  }
});

// Node build configuration
await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.node.js',
  platform: 'node',
  define: {
    'process.env.TARGET': '"node"'
  }
});