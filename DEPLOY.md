# Railway deploy

This project is set up so Railway can deploy it from the repo root.

If you are replacing an older broken setup, remove these old files from the repo before pushing:

- `Dockerfile`
- `railway.toml`
- `nixpacks.toml`
- `render-build.sh`
- `.dockerignore`
- `.nvmrc`

## What Railway runs

Build command:

```bash
npm run build
```

Start command:

```bash
node server/src/index.js
```

These are defined in `railway.json`, so you do not need to add custom commands in the Railway dashboard.

## Local check

```bash
npm run build
npm start
```

Server health check:

```bash
http://localhost:3002/health
```
