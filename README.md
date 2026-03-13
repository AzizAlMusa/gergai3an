# Trivia Playful Live V4

Use two terminals.

## Install
npm install
npm run install:all

## Run
npm run dev:server
npm run dev:client

Server: http://localhost:3002
Client: http://localhost:5173


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
