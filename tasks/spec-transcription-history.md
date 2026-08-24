# Specification: Local transcription history

## Scope

Add a loopback-only Node service that stores transcription tasks in SQLite and serves the built React application. Audio remains in browser memory; the database stores only the audio filename and transcript text. Ollama remains local at `127.0.0.1:11434`.

## Data model

`transcriptions` contains the required `id`, `audio_source`, `raw_text`, `corrected_text`, and `status` fields plus `created_at` and `updated_at` timestamps needed by the task table and audit trail. Status is constrained to `processing`, `completed`, `corrected`, `edited`, or `error`.

## API contract

- `GET /api/transcriptions?limit=100&offset=0` lists bounded newest-task summaries without transcript bodies.
- `GET /api/transcriptions/:id` reads one full transcript only when its editor is opened.
- `POST /api/transcriptions` creates a processing task from `{ "audioSource": string }`.
- `POST /api/transcriptions/:id/segments` appends `{ "text": string }` immediately and atomically to `raw_text`.
- `PATCH /api/transcriptions/:id/status` updates `{ "status": "completed" | "error" }`.
- `PATCH /api/transcriptions/:id` saves `{ "correctedText": string }` and marks the task edited.
- `POST /api/transcriptions/:id/correct` corrects the selected task using `{ "model": string }`, saves the result, and returns the updated row.

All responses are JSON. Invalid input returns `400`, missing rows return `404`, conflicts return `409`, oversized bodies return `413`, unavailable Ollama returns `502`, and internal failures return a generic `500` without transcript content.

## UI behavior

The `#tasks` route displays completed, corrected, edited, and failed tasks in a responsive ledger table with ID, source, timestamp, status, and actions. Opening a row reveals an editor initialized from `corrected_text ?? raw_text`. Save and local-model correction replace that row from the successful API response without reloading the page.

During Whisper inference the workspace creates one task, appends each received segment to SQLite, and marks the task completed only after the worker finishes. Persistence failures do not discard the in-memory transcript; they produce a visible local-archive warning.

## Privacy and security

- Bind the service to `127.0.0.1` by default.
- Use prepared statements, schema constraints, strict body/text limits, fixed database location, fixed Ollama loopback origin, request timeouts, and response-size limits.
- Never log filenames, transcript text, prompts, model output, or request bodies.
- Store the database under ignored `data/`; no cloud synchronization, telemetry, authentication, or audio persistence is introduced.

## Acceptance criteria

- Database and conservative correction unit tests pass.
- Every Whisper segment is queued for an atomic SQLite append.
- Manual and LLM edits persist and update the visible row immediately.
- The table is keyboard-operable and usable at desktop and mobile widths.
- Lint, tests, typecheck, asset verification, build, and production smoke checks pass.
