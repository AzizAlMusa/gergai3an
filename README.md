# Trivia Playful Live V4

## Local development

Install dependencies and build the client:

```bash
npm run build
```

Start the server:

```bash
npm start
```

Default local server URL:

- http://localhost:3002

## Railway deployment

This repository includes:

- `Dockerfile` for deterministic Railway builds
- `railway.toml` with a health check on `/health`
- `package.json` scripts that install the nested `client` and `server` dependencies cleanly

Railway will serve:

- `/join`
- `/team`
- `/host`
- `/display`

## Question media

Questions and answers can include optional media files. Save media under `client/public/media/` and reference them from `server/src/db/questions.json` with public paths such as `/media/questions/audio/example.mp3`.

Supported optional JSON fields:

- `question_image`
- `question_audio`
- `question_video`
- `answer_image`
- `answer_audio`
- `answer_video`

You can also use nested objects:

```json
{
  "question_media": { "image": "/media/questions/images/example.png" },
  "answer_media": { "audio": "/media/answers/audio/example.mp3" }
}
```
