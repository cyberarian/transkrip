# Production Readiness

## Verdict

The codebase is suitable for a controlled local-first release after bootstrap credentials are configured and the loopback production runtime is smoke-tested. Generic static hosting is incomplete because it cannot provide authenticated SQLite persistence or the fixed-loopback correction endpoint.

## Verified release gates

- `npm ci` uses the committed lockfile with lifecycle scripts disabled.
- `npm run check` gates lint, unit/privacy tests, strict TypeScript, binary checksums, and the production build.
- `npm audit --omit=dev --audit-level=high` gates reachable production dependencies.
- Browser transcription writes each recognized segment through the loopback API to device-local SQLite. Audio remains local: decoding occurs in browser memory, and optional diarization uses a bounded loopback WAV staging file that is deleted after finalization or interruption.
- Page assets use the same origin; CSP blocks unexpected destinations.
- Optional spelling correction is explicit and the Node service connects only to loopback Ollama.
- Optional DocETL analysis is explicit, owner-scoped, sequential, persisted, and restricted to the loopback worker and Ollama; temporary transcript-derived worker data is deleted at process exit.
- Every server start performs a bounded fixed-loopback Ollama metadata probe; signed-in users see the current result and can trigger a same-origin retry without sending transcript content.
- Local accounts use scrypt password hashes and opaque server-side sessions. Transcript operations derive ownership from the authenticated session; administrators manage accounts but receive no cross-tenant transcript bypass.
- Unsafe authenticated requests require a same-origin context, and cross-tenant record probes return the same non-disclosing `404` response.
- Audio/model size limits, worker validation, non-overlapping engine requests, and bounded Ollama responses reduce memory and consumption abuse.
- A real Chromium smoke test completed Base multilingual inference against a locally generated, non-sensitive ID/EN WAV and produced three timestamped segments.
- The recommended correction model `csalab/sahabatai1:llama3_base_Q4_K_M` is installed in local Ollama and visible in Settings.
- This directory is an independent Git repository and browser model binaries are managed through Git LFS.

## Deployment checklist

1. Build on Node 24 with `npm ci && npm run check`.
2. Before the first account-aware start, back up `data/transkrip.sqlite`, copy `.env.example` to `.env`, and replace the bootstrap username, display name, and password. The password must be unique and contain 12–128 characters.
3. Run `npm start` and confirm it binds to `127.0.0.1:8787` and creates or migrates `data/transkrip.sqlite` with owner-only directory permissions. Startup must fail when a database has no users and bootstrap credentials are missing.
4. Sign in as the bootstrap administrator, then remove every `TRANSKRIP_ADMIN_*` bootstrap entry from `.env`. Existing databases with at least one user do not require bootstrap variables, and partial bootstrap credentials are rejected.
5. Confirm every response receives the production security headers; in particular, COOP and COEP must be present for threaded WASM.
   Confirm the page policy rejects `unsafe-eval` and only `/whisper/engine-worker.js` receives the checked-in Emscripten runtime's path-scoped exception.
6. Confirm the correction service targets only `http://127.0.0.1:11434/api/chat`.
7. If Analysis is enabled, install `analysis/requirements.txt`, confirm `/api/runtime/docetl` reports DocETL 0.3.0 ready, and verify the worker binds only to `127.0.0.1:8770`.
8. Do not expose the application, Ollama, or either Python worker to the public network. All must bind to loopback.
9. Verify model/runtime checksums with `npm run assets:verify` before packaging.
10. Run the smoke test below in an isolated current Chromium browser.

## Smoke test

1. Load the production URL and confirm it shows the login checkpoint without exposing application data; confirm the browser console has no errors or warnings.
2. Sign in as the bootstrap administrator. Create one enabled standard user and one administrator candidate, then confirm the last enabled administrator cannot be disabled or deleted.
3. Confirm network requests target only the application origin; do not invoke correction yet.
4. Open setup, load Base multilingual, and confirm the UI reports `WASM threads aktif`.
5. Import a short non-sensitive ID/EN recording, play/seek it with mouse and keyboard, then transcribe.
6. Open **Tasks**, confirm the completed row and timestamp, edit it, save it, reload, and verify the edit remains.
7. Sign out and sign in as the standard user. Confirm the administrator's task is absent and direct read, update, correction, and deletion requests for its ID all return a generic `404`.
8. Create, edit, and delete a task as the standard user; confirm each change persists after reload and does not alter the administrator's task.
9. Export TXT and SRT; inspect that TXT uses clean sentence formatting and SRT timestamps are ordered and valid.
10. With Ollama stopped, start Transkrip and confirm the account bar reports that Ollama is unavailable while the app remains usable. Then start Ollama, select the status control, and confirm it reports connected. Invoke row correction and confirm all Ollama calls remain on loopback.
11. Disable the standard user from the administrator account and confirm its existing session is revoked. Re-enable it, reset its credential, and confirm only the replacement credential works.
12. Repeat layout checks at 320, 768, 1024, and 1440 CSS pixels and with reduced motion enabled.
13. When DocETL is installed, open **Analysis**, select a non-sensitive completed task, run meeting minutes, change routes while it runs, and confirm the owner-only result persists and exports without exposing source text in server logs.

## Observability without telemetry

To preserve privacy, the application sends no analytics or remote error reports. Operational evidence is intentionally local:

- user-visible status messages for model, decoding, transcription, and correction failures;
- browser console and network panels during controlled support sessions;
- structured local API logs containing only request ID, method, normalized route, status, and duration;
- one startup Ollama event containing only status, bounded reason, latency, model count, and recommended-model availability;
- DocETL worker lifecycle and failure events containing only readiness, version, status, duration, and sanitized error type;
- host CPU, memory, disk, and process-health monitoring that contains no transcript data.

Never log request bodies, filenames, transcript text, model prompts/output, or exported content.

## Rollback

Application rollback is artifact-based; local history must be preserved separately:

1. Retain the previous verified `dist/` artifact and its asset checksum file.
2. Stop the service and copy `data/transkrip.sqlite`, `-wal`, and `-shm` together before any database recovery action.
3. If a regression appears, atomically restore the previous application artifact without deleting or downgrading the database.
4. Verify headers, existing task visibility, model load, and a short local transcription.
5. Clear only the affected browser HTTP cache if needed; do not clear local history or unrelated browser data.

The account/ownership migration is forward-only. Roll back application code without downgrading the migrated schema. Restore the complete pre-migration SQLite backup only when deliberately reverting all post-migration account and transcript changes.

## Residual risks and release-owner decisions

- The browser artifact is approximately 840 MB because it intentionally bundles three models. Production hosting needs adequate disk, transfer, cache, and deployment time budgets.
- Full Whisper inference remains a release smoke test rather than a unit test because it executes a 141 MB model. Generate a non-sensitive fixture locally (for example with `espeak`) and require at least one ordered segment before release.
- No centralized telemetry exists by design. Support and incident response must use redacted local diagnostics.
- The loopback login throttle is process-local and resets on restart. Any future LAN or internet deployment requires HTTPS, a shared rate limiter, revised session controls, and a new threat review.
- There is intentionally no email or cloud credential recovery. Keep at least two enabled administrator accounts after bootstrap and store recovery credentials using the operating system's credential manager.
- Physical Safari/iOS and Chrome/Android checks still require the release owner's target devices; the automated Chromium checks do not substitute for those runtimes.
