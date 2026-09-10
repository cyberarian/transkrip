# Durable workspace recovery

## Problem

Workspace text, timestamps, selection, and playback position previously existed only in React memory. Expiring a session unmounted the workspace and terminated its worker. The archive retained partial plain text, but lacked the chunk position required to continue inference. A failed incremental append was skipped; subsequent appends could make the archive appear more complete than it was.

## Behavior

- Each account has a versioned workspace checkpoint in device-local SQLite. It includes transcript segments, timestamps, selection, playback position, language, model name, diarization preference, original-file SHA-256 fingerprint, task ID, and the next inference sample.
- Edits coalesce for 500 ms. Backgrounding, freeze/resume, reconnect, and explicit save flush pending changes. Small writes use fetch keepalive; larger writes use normal fetch. Unsaved changes register a before-unload warning. Save failures remain visible and retry while the page is visible or after same-account reauthentication.
- Every completed ASR chunk waits for an acknowledged checkpoint before the next chunk starts. Partial text and its task archive are updated transactionally with the checkpoint. No non-persistent transcription starts if SQLite is unavailable.
- Retrying after a lost response uses the same operation ID and revision. A stale tab receives a conflict rather than overwriting a newer checkpoint. Account identity is enforced on the server; client owner headers only detect stale in-memory work after an account switch and do not grant access.
- Session expiry locks the UI but preserves mounted workspace and task editors. Reauthentication to the same account retains them; a different account remounts the owner-keyed tree. Logout flushes pending work first.
- Tasks dialogue edits autosave after 600 ms. The Tasks editor remains mounted when navigating away. Each successfully corrected paragraph also checkpoints before correction advances.
- Restoring after reload requires reselecting the original recording for playback or inference. Its fingerprint must match. Audio bytes and model buffers are not persisted. The model must be loaded again after a browser restart or failed worker. Recovery continues at the last complete chunk and recomputes an unfinished chunk; it does not duplicate earlier segments.
- A screen wake lock is requested during transcription where available and released when processing ends. It is an optimization, never the persistence guarantee.

## Boundaries

A sleeping OS or a frozen browser can suspend computation. No background JavaScript can guarantee continued execution while the machine sleeps. Checkpoints, rather than unload callbacks or wake locks, provide recovery. See [Chrome's Page Lifecycle guidance](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) and [MDN's wake-lock lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).

The save indicator means the current checkpoint was acknowledged by SQLite. Edits still marked unsaved cannot survive a browser crash if the local service is unreachable. Do not clear browser memory or close the tab in that state; restore the service or export the text first. Checkpoints are bounded to 900 KB of UTF-8 JSON and never include audio, credentials, or cloud copies. The existing Tasks archive remains the record of earlier tasks; the workspace checkpoint restores the current workspace.

This change does not move ASR to a background daemon. Server-side analysis continues to use its existing persistent run records; a server restart still interrupts an active model invocation under its existing recovery behavior.

## Performance and verification

A controlled 120-position-update waveform benchmark with the same 60-second PCM buffer and 1440px canvas produced 120 canvas rebuilds and 120 ResizeObserver constructions before the change, versus one of each afterward. The canvas now redraws only for PCM or size changes; an SVG playhead handles position updates. This measures the rendering path, not recognition throughput. The isolated run took approximately 1114 ms before versus 11 ms after; operation counts are the durable evidence, not the environment-dependent timing.

A coordinator test stages 100 successive edits and verifies one write with the latest value. Other tests exercise lost-response retries, changes arriving during a save, input bounds, tenant isolation, stale revisions, SQLite reopen, correction interruption, and worker continuation only after durable acknowledgment.

Browser QA uses an isolated database and synthetic content. A real reload restored edited text. Revoking the test session, then reauthenticating, preserved the exact workspace DOM instance and its transcript.

An offline browser test retained the edited paragraph, showed an unsaved state, and committed the same text after reconnect. A synthetic Tasks dialogue autosaved without pressing Save and retained its contents across route changes. Lint, 162 tests, the production build, and bundled asset hashes passed. Real hardware sleep and full-model inference throughput were not benchmarked; worker resume is covered by a simulated WASM runtime with real checkpoint handshakes.
