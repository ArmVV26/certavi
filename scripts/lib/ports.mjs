// Shared port probing used by scripts/ports-check.mjs (CLI) and scripts/hooks/ports-warn.mjs.
// No side effects on import.

import { execFileSync } from 'node:child_process';
import net from 'node:net';

//   5173 vite dev · 4173 vite preview (Playwright) · 8888 netlify dev · 8787 mock sync server
//   9323 Playwright HTML report (only if someone runs show-report)
export const PORTS = [
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

/**
 * Probes the given ports (default: all of PORTS).
 * @param {{ port: number, use: string }[]} [ports]
 * @returns {Promise<{ port: number, use: string, busy: boolean, owners: string }[]>}
 */
export async function checkPorts(ports = PORTS) {
  const isWindows = process.platform === 'win32';
  const listeners = isWindows ? windowsListeners() : new Map();
  const results = [];

  for (const { port, use } of ports) {
    const probes = await Promise.all(HOSTS.map((host) => isListening(host, port)));
    const pids = listeners.get(port);
    const busy = probes.some(Boolean) || (pids !== undefined && pids.size > 0);
    const owners = busy
      ? pids
        ? [...pids].map((pid) => `${windowsProcessName(pid)} (PID ${pid})`).join(', ')
        : 'process unknown'
      : '';
    results.push({ port, use, busy, owners });
  }
  return results;
}
