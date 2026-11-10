# Processes and ports (Windows)

- Never leave a server running. If you start one (`vite`, `vite preview`, `netlify dev`,
  the mock sync server, Playwright web server), stop it before finishing the task and
  verify the port is free (`npm run ports:check`). Ports used: 5173, 4173, 8888, 8787, 9323.
- Prefer one-shot commands: `vitest run` (not watch), `playwright test` with its own webServer.
- If a port is busy at start, report it instead of picking another one silently.
