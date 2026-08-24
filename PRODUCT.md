# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated: React, TypeScript, and Vite for a maintainable enterprise web client; whisper.cpp compiled to WebAssembly and isolated in a Web Worker for fully on-device inference.

## Users

Professional users working inside enterprise ecosystems who need dependable Bahasa Indonesia and English transcription.

## Product Purpose

Turn recorded or live workplace audio into editable, timestamped Bahasa Indonesia and English transcripts without sending recordings, models, or transcript content to a server.

## Positioning

The transcription workspace performs speech recognition entirely on the user's device through whisper.cpp, making local processing a visible and verifiable part of the workflow rather than a background privacy claim.

## Operating Context

Users work with meetings, interviews, calls, and other professional recordings. They need to import audio, select or detect Bahasa Indonesia and English, monitor local processing, review timestamped text, search and edit the result, and export it for use in other enterprise tools.

## Capabilities and Constraints

- Audio processing and transcription must remain on-device.
- Transcript text and the imported audio filename may persist only in device-local SQLite; audio bytes must not be stored there.
- Optional speaker diarization may stage audio only long enough for a loopback pyannote.audio run, then must delete it.
- Speech recognition uses whisper.cpp through WebAssembly.
- Bahasa Indonesia, English, and automatic language detection are supported.
- An optional Indonesian-tuned Medium Q5_0 model is available locally for Bahasa-first recordings; the original F16 model is retained for native whisper.cpp use because it exceeds the browser WASM memory ceiling.
- Bundled model files are served by the same local application origin and loaded into session memory; imported model files are read directly from the user's device and are not persisted by the application.
- Browser capability and available device memory constrain model size and speed.
- Local multi-tenant identity uses administrator-managed accounts, opaque sessions, and owner-scoped SQLite records. External identity providers, centralized policy management, shared workspaces, and cloud synchronization remain open decisions; the product must not imply that local content is uploaded.
- Optional DocETL analysis is an explicit owner action over 1–8 selected completed transcripts. Node must enforce tenant scope; the loopback worker must not access SQLite, retain transcript-derived cache, optimize pipelines automatically, or contact a non-local model provider.
- Top-level navigation labels use concise English words (Workspace, Tasks, Analysis, Settings, About, Users); explanatory and workflow content remains Bahasa Indonesia unless transcript content naturally uses English.

## Evidence on Hand

The upstream whisper.cpp project and its browser WebAssembly examples are the implementation reference. No customer claims, benchmarks, logos, or proprietary brand assets were provided and none should be fabricated.

## Product Principles

- Keep private material visibly local from import through export.
- Make long-running device work predictable and interruptible.
- Optimize review speed, not just transcript generation.
- Treat Bahasa Indonesia and English as equal first-class workflows.
- Communicate model, browser, and hardware constraints plainly.

## Accessibility & Inclusion

The professional workflow must be keyboard-operable, screen-reader legible, responsive, and usable with reduced motion. Status and language must never be conveyed by color alone.
