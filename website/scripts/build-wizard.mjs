// Builds the frontend "wizard" app and copies it into static/wizard-app so Docusaurus can serve it
// under /wizard-app/. Written in Node (rather than a shell one-liner) so it runs the same on
// Windows, macOS, and Linux — the previous `VITE_BASE=… && rm -rf … && cp -r …` form only worked
// in a POSIX shell.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {rmSync, cpSync, existsSync} from 'node:fs';
import path from 'node:path';

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendDir = path.resolve(websiteRoot, '..', 'packages', 'frontend');
const frontendDist = path.join(frontendDir, 'dist');
const target = path.join(websiteRoot, 'static', 'wizard-app');

// 1. Build the frontend with the docs base path. Run npm inside the frontend dir (via `cwd`, not a
// `--prefix` path argument). `shell: true` is required on Windows, where Node refuses to spawn
// npm.cmd without a shell (EINVAL, since the CVE-2024-27980 fix). The command is passed as one fixed
// string with no args array: that avoids the DEP0190 "args not escaped" warning, and since it holds
// no filesystem path (the dir comes from `cwd`), a project path with spaces can't break it.
const build = spawnSync('npm run build', {
  cwd: frontendDir,
  env: {...process.env, VITE_BASE: '/wizard-app/'},
  stdio: 'inherit',
  shell: true,
});
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

// 2. Replace static/wizard-app with the fresh build.
if (!existsSync(frontendDist)) {
  console.error(`✘ Expected frontend build output at ${frontendDist} but it does not exist.`);
  process.exit(1);
}
rmSync(target, {recursive: true, force: true});
cpSync(frontendDist, target, {recursive: true});
console.log(`✔ Copied wizard app to ${path.relative(websiteRoot, target)}`);
