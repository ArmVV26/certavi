# Deploying Certavi on Netlify

Certavi runs as a **new, separate Netlify project** next to `gym_app`, which keeps working
unchanged until Certavi reaches v1.0.0. Everything here is done by hand in the Netlify UI; the
build itself is configured in [`netlify.toml`](../netlify.toml).

| What          | Value                                                                       |
| ------------- | --------------------------------------------------------------------------- |
| Build command | `npm run build` (from `netlify.toml`)                                       |
| Publish dir   | `dist`                                                                      |
| Functions     | `netlify/functions` (`sync.ts` serves `/api/v1/sync` and `/api/v1/backups`) |
| Node          | 22                                                                          |
| Storage       | Netlify Blobs, nothing to enable                                            |
| Secret        | `CLAVE_SYNC`, at least 32 characters                                        |

## 1. Create the project

1. Netlify → **Add new project** → **Import an existing project** → **GitHub**.
2. Allow Netlify to read the private `certavi` repository (only that repository).
3. Leave the build settings Netlify reads from `netlify.toml` as they are.
4. **Project name**: pick one that is hard to guess (for example `certavi-` followed by random
   letters). The URL is `https://<name>.netlify.app`; the site is not indexed (`noindex`,
   `robots.txt`) but the name should not be obvious either.

## 2. Branches and deploys

Project configuration → **Build & deploy** → **Branches and deploy contexts**:

- **Production branch:** `main`.
- **Branch deploys:** _Let me add individual branches_ → `dev` only. It is published at
  `https://dev--<name>.netlify.app`.
- **Deploy Previews:** _Don't deploy pull requests_. Every deploy uses build credits of the free
  plan; feature branches are tested locally.

Each deploy context has its own data: production stores records in the blob store `certavi`,
the `dev` branch deploy in `certavi-branch-deploy`. Testing on `dev` never touches real data.

## 3. The sync secret

1. Generate a secret on your PC (43 random characters):

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

2. Project configuration → **Environment variables** → **Add a variable**:
   - Key: `CLAVE_SYNC`
   - Mark **Contains secret values**.
   - Scope: **Functions** (it is not needed at build time).
   - Values per deploy context: one value for **Production** and a **different** one for
     **Branch deploys**, so the `dev` key cannot write to production.
3. Store the secrets in your password manager. Never commit them, paste them in an issue or
   send them in a chat.
4. **Deploys → Trigger deploy → Deploy project** so the function picks up the variable.

If `CLAVE_SYNC` is missing or shorter than 32 characters, every request answers
`500 server-misconfigured`.

## 4. Check that it works

On each device: **Ajustes → Sincronización**, paste the key in "Clave de sincronización" and
press "Guardar clave". Within a few seconds the status says "Sincronizado" and the header icon
turns green; "Registro y copias del servidor" lists every attempt. The `dev` branch deploy uses
its own key (the one for **Branch deploys**).

To diagnose a problem without the app, call the API directly. In PowerShell use `curl.exe`
(plain `curl` is an alias of another command):

```sh
# Without the key → 401 {"error":"unauthorized"} (after a short delay)
curl.exe -i https://<name>.netlify.app/api/v1/backups

# With the key → 200 {"backups":[]} on a new project
curl.exe -i -H "Authorization: Bearer <CLAVE_SYNC>" https://<name>.netlify.app/api/v1/backups
```

Typing the key in a terminal leaves it in the shell history; clear it afterwards or use the app.

## 5. Day-to-day

- Merging into `dev` deploys `https://dev--<name>.netlify.app`; merging into `main` deploys
  production.
- The server keeps one backup per day (Madrid time) of the data before the first change of the
  day, and the 14 most recent ones. They are listed and restored from the app.
- Changing `CLAVE_SYNC`: set the new value, redeploy, and enter the new key on every device
  ("Cambiar clave"). Each device then uploads everything it has again; nothing is lost.
- Restoring a backup: Ajustes → Sincronización → "Registro y copias del servidor" →
  "Restaurar". The other devices follow on their next sync.
