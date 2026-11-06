// Reports which of the project's dev ports are busy and, on Windows, which process holds them.
// Exit code: 0 = all free, 1 = at least one port is busy.
//
//   5173 vite dev · 4173 vite preview (Playwright) · 8888 netlify dev · 8787 mock sync server
//   9323 Playwright HTML report (only if someone runs show-report)
//
// Usage: npm run ports:check        (free them with: npm run ports:kill)
// The probing logic lives in scripts/lib/ports.mjs (shared with the Stop hook).

import { checkPorts } from './lib/ports.mjs';

let busyCount = 0;

for (const { port, use, busy, owners } of await checkPorts()) {
  if (!busy) {
    console.log(`  free  ${port}  (${use})`);
    continue;
  }

  busyCount++;
  console.log(`  BUSY  ${port}  (${use})  ← ${owners}`);
}

if (busyCount > 0) {
  console.log(`\n${busyCount} port(s) busy. Stop the process or run: npm run ports:kill`);
  process.exitCode = 1;
} else {
  console.log('\nAll ports free.');
}
