# Trivia Night — Railway Deploy

This repo is set up to deploy on Railway with the root `Dockerfile`.

## What Railway will do
- Detect the root `Dockerfile`
- Build the React client inside the image
- Install the server dependencies
- Start the app with `node server/src/index.js`
- Health check the service at `/health`

## Deploy steps
1. Push this project to GitHub.
2. In Railway, create a new project from that GitHub repo.
3. Railway will use the included `Dockerfile` automatically.
4. Generate a public domain in **Networking**.

## Routes
- `/join`
- `/team`
- `/host`
- `/display`
- `/health`

## Notes
- Railway provides the `PORT` environment variable automatically.
- The server already binds to `0.0.0.0` and reads `process.env.PORT`.
- Static files are served from `client/dist` after the client build completes.
