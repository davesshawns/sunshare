import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('⚡ Starting SUNSHARE Peer-to-Peer Energy Exchange...');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const serverProc = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(rootDir, 'server'),
  stdio: 'pipe',
  shell: true,
  env: { ...process.env, PORT: '3003' },
});

const clientProc = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(rootDir, 'client'),
  stdio: 'pipe',
  shell: true,
  env: { ...process.env },
});

serverProc.stdout.on('data', (d) => process.stdout.write(`\x1b[33m[api]\x1b[0m ${d}`));
serverProc.stderr.on('data', (d) => process.stderr.write(`\x1b[31m[api:err]\x1b[0m ${d}`));

clientProc.stdout.on('data', (d) => process.stdout.write(`\x1b[36m[web]\x1b[0m ${d}`));
clientProc.stderr.on('data', (d) => process.stderr.write(`\x1b[31m[web:err]\x1b[0m ${d}`));

function cleanup() {
  console.log('\nShutting down SUNSHARE services...');
  serverProc.kill();
  clientProc.kill();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
