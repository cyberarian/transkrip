# Audio import memory verification

Verified in Chromium on 2026-09-14 using generated PCM WAV and H.264/AAC MP4 fixtures.

| Change | Baseline → result | Decision |
| --- | --- | --- |
| Decode at 16 kHz | Three-minute stereo decoded sample storage: 69.12 MB at 48 kHz → 23.04 MB at 16 kHz | Keep; duration and nonzero signal verified in browser |
| Reuse bytes after hashing | Two file reads → one; stream chunks copied straight into one destination | Keep; exact-byte and progress regression tests pass |
| Remove media-element offline rendering | Unsupported `OfflineAudioContext.createMediaElementSource` → successful two-second MP4 decode, 32,000 samples, nonzero signal | Keep |

A 115,200,044-byte, ten-minute stereo WAV imported in approximately 2.48 seconds and produced 9,600,000 mono samples with 57 progress updates. This is a synthetic functional check, not a general timing guarantee. The memory figures describe decoded sample storage, not total browser peak memory; native codec allocations, hashing, the compressed input, and the Whisper model require additional memory.

The default browser path retains the 250 MB input and four-hour duration limits. Browser codec support still determines which video containers can be decoded. The full file is required by `decodeAudioData`; this is not streaming transcription. Duration validation happens after decoding, so highly compressed long recordings may exhaust memory before validation.

## Optional FFmpeg preparation

Verified in Chromium on macOS with FFmpeg 9.0.1 on 2026-09-14. A generated 276,480,078-byte stereo PCM WAV (24 minutes, 48 kHz) passed through the real authenticated local HTTP endpoint and became ready in the workspace. The request took approximately 3.27 seconds and returned 92,160,000 bytes of mono 16 kHz Float32 PCM; the player reported 1,440 seconds. The local staging directory was empty after completion. A synthetic MKV containing AAC audio also became ready (approximately two seconds).

These fixtures verify preparation and UI readiness, not speech-recognition accuracy, peak-memory usage, the full 2 GiB/four-hour boundary, or performance on other hardware. Windows and Linux browser integration for the descriptor-based preparation path was not exercised in this session. The normal browser decoder measurements above remain a separate path.

The new mode reports real upload/download progress and an indeterminate conversion phase. Cancellation and missing-executable cleanup, bounded input handling, fingerprint preservation, and single-job slot recovery have automated coverage. Source-reference focus/navigation and an analysis DOCX download with the exact source quote and internal bookmark were checked in the real browser using a separate synthetic database. Narrow-screen preparation controls were inspected at 390 × 844.

Workspace and saved-dialogue DOCX downloads also completed in Chromium. The analysis file was inspected as an OOXML ZIP and contained the exact quote, `w:anchor`, and matching bookmark. Final automated verification: 141 frontend tests, 57 server tests, three Python contract tests, lint, TypeScript, asset checksums, and production build passed. The real DocETL/Ollama generation path was not run in this smoke test; seeded analysis results and a service test double verified citation contracts and presentation.
