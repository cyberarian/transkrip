# Spec: Local bilingual speaker diarization

## Objective

Extend Transkrip with locally persisted, speaker-attributed Indonesian/English dialogue. Browser Whisper remains the speech-to-text engine. An optional loopback pyannote.audio Community-1 sidecar identifies speaker time ranges; the Node API aligns those ranges to Whisper timestamps and stores a structured dialogue document. If diarization is unavailable, completion falls back to one language-appropriate default speaker without losing transcription data.

## Data model

The migration preserves all existing rows and adds canonical fields: `audio_file`, `language`, `raw_transcript`, `formatted_transcript`, `speakers`, and `created_at`. Existing `audio_source`, `raw_text`, and `corrected_text` remain compatibility mirrors during this release. `formatted_transcript` and `speakers` are JSON strings validated at the API boundary.

```ts
type SpeakerBlock = {
  id: string
  speakerId: string
  speakerLabel: string
  start: number
  end: number
  text: string
}
```

## Local processing contract

1. The browser creates a task with filename and language.
2. The decoded mono 16 kHz PCM is encoded as WAV and uploaded to the loopback API with a 250 MB hard limit.
3. Whisper segments continue to be saved as they arrive.
4. On completion, the browser submits segment timestamps. The Node service asks `127.0.0.1:8765` for exclusive speaker turns, aligns by maximum time overlap, merges adjacent blocks for the same speaker, persists JSON, and deletes temporary audio in all outcomes.
5. Sidecar failure yields one default speaker and a completed record with explicit `diarization: fallback` metadata.

## API changes

- `POST /api/transcriptions` accepts `{ audioFile, language }`.
- `PUT /api/transcriptions/:id/audio` accepts `audio/wav` only.
- `POST /api/transcriptions/:id/finalize` accepts bounded timestamped segments and performs local diarization/fallback.
- `PATCH /api/transcriptions/:id/document` accepts the complete validated speaker-block document.
- `POST /api/transcriptions/:id/normalize` applies the selected local Ollama model per speaker block and persists the result.

## Editor

The expanded task row renders speaker turns, not one monolithic textarea. Each block supports inline text editing. Renaming a speaker updates every block sharing its stable `speakerId`. Save and normalize replace the in-memory row/document from the API response immediately.

## Security and privacy

- Node and Python bind to loopback only.
- Temporary WAV names are server-generated; user filenames never become paths.
- Audio is deleted after finalize, error, or startup cleanup; it is never stored in SQLite.
- Hugging Face tokens are sidecar environment configuration only and are never accepted by the web API, logged, or persisted.
- No Deepgram, AssemblyAI, pyannoteAI cloud API, telemetry, or remote audio transfer.

## Commands

- Development: `npm run dev -- --host 127.0.0.1`
- Sidecar: `python3 diarization/service.py`
- Test: `npm test`
- Full gate: `npm run check`

## Success criteria

- Existing SQLite histories migrate without data loss.
- Completed rows contain language, raw transcript, structured formatted transcript, and speakers JSON.
- Speaker alignment and global rename have behavior tests.
- Missing sidecar still produces an editable one-speaker document.
- Manual and Ollama-normalized edits survive reload.
- No audio persists after finalization.

## Boundaries

- Always: validate JSON shapes, use prepared statements, keep services loopback-only, delete temporary audio.
- Ask first: any cloud provider, authentication system, or persistent audio storage.
- Never: log or persist credentials, audio content, transcript bodies, prompts, or model output.
