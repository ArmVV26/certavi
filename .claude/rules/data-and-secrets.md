# Data and secrets

- Never read, copy or commit real user data (exported JSON from the old app) or `.env*`.
- Never print or hardcode `CLAVE_SYNC` or any secret. Tests use synthetic data only.
- Tests use **synthetic data only** — never real exports from gym_app.
- Never read `backups/`.
