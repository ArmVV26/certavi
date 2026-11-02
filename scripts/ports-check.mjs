// Reports which of the project's dev ports are busy and, on Windows, which process holds them.
// Exit code: 0 = all free, 1 = at least one port is busy.
//
//   5173 vite dev · 4173 vite preview (Playwright) · 8888 netlify dev · 8787 mock sync server
//   9323 Playwright HTML report (only if someone runs show-report)
//
// Usage: npm run ports:check        (free them with: npm run ports:kill)

import { execFileSync } from 'node:child_process';
import net from 'node:net';

const PORTS = [
  { port: 5173, use: 'vite dev' },
  { port: 4173, use: 'vite preview / Playwright' },
  { port: 8888, use: 'netlify dev' },
  { port: 8787, use: 'mock sync server' },
  { port: 9323, use: 'Playwright HTML report (show-report)' },
];
const HOSTS = ['127.0.0.1', '::1'];
const TIMEOUT_MS = 500;

/** Resolves true if something accepts TCP connections on host:port. */
function isListening(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(TIMEOUT_MS, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

/** Windows only: map of port → set of PIDs in LISTENING state. */
function windowsListeners() {
  const byPort = new Map();
  try {
    const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8', windowsHide: true });
    for (const line of out.split(/\r?\n/)) {
      const cols = line.trim().split(/\s+/);
      // Proto  Local Address  Foreign Address  State  PID
      if (cols.length < 5 || cols[0] !== 'TCP' || cols[3] !== 'LISTENING') continue;
      const port = Number(cols[1].slice(cols[1].lastIndexOf(':') + 1));
      if (!byPort.has(port)) byPort.set(port, new Set());
      byPort.get(port).add(cols[4]);
    }
  } catch {
    // netstat not available: fall back to the connection probe only.
  }
  return byPort;
}

function windowsProcessName(pid) {
  try {
    const out = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    const match = /^"([^"]+)"/.exec(out.trim());
    return match ? match[1] : 'unknown';
  } catch {
    return 'unknown';
  }
}

const isWindows = process.platform === 'win32';
const listeners = isWindows ? windowsListeners() : new Map();
let busyCount = 0;

for (const { port, use } of PORTS) {
  const probes = await Promise.all(HOSTS.map((host) => isListening(host, port)));
  const pids = listeners.get(port);
  const busy = probes.some(Boolean) || (pids !== undefined && pids.size > 0);

  if (!busy) {
    console.log(`  free  ${port}  (${use})`);
    continue;
  }

  busyCount++;
  const owners = pids
    ? [...pids].map((pid) => `${windowsProcessName(pid)} (PID ${pid})`).join(', ')
    : 'process unknown';
  console.log(`  BUSY  ${port}  (${use})  ← ${owners}`);
}

if (busyCount > 0) {
  console.log(`\n${busyCount} port(s) busy. Stop the process or run: npm run ports:kill`);
  process.exitCode = 1;
} else {
  console.log('\nAll ports free.');
}
