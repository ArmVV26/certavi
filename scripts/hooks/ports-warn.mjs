// Stop hook: warns the USER (not Claude) when a dev port is left busy at the end of a turn.
// Prints {"systemMessage": "..."} and always exits 0 — never 2, which would force another turn.

import { checkPorts, PORTS } from '../lib/ports.mjs';

// Ports not worth a warning (the user usually keeps `npm run dev` on 5173). Edit as needed.
const IGNORED_PORTS = [5173];

try {
  // Stdin is the Stop event; if a Stop hook already continued Claude, say nothing.
  let raw = '';
  try {
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) raw += chunk;
  } catch {
    // no stdin: carry on
  }
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {
    // not JSON: carry on
  }

  if (input.stop_hook_active !== true) {
    const watched = PORTS.filter(({ port }) => !IGNORED_PORTS.includes(port));
    const busy = (await checkPorts(watched)).filter((p) => p.busy);
    if (busy.length > 0) {
      const list = busy.map((p) => `${p.port} (${p.use}) ← ${p.owners}`).join('; ');
      const systemMessage = `Puertos ocupados: ${list}. Libéralos con: npm run ports:kill`;
      process.stdout.write(`${JSON.stringify({ systemMessage })}\n`);
    }
  }
} catch {
  // Never fail a turn because of a warning.
}
process.exit(0);
