# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated: React, TypeScript, and Vite for a maintainable enterprise web client; whisper.cpp compiled to WebAssembly and isolated in a Web Worker for fully on-device inference.

## Users

People who need to turn spoken information into usable records across public and private organizations, including legal work, media, education, human resources, corporate secretariat, public communication, libraries, and archives. The app should be usable without an information-management or technical background.

## Product Purpose

Help people turn recordings into reviewable, searchable Bahasa Indonesia and English transcripts and useful working documents while keeping processing and records on their own device. The current workflow imports recordings; live capture is a future possibility, not an existing capability.

## Positioning

A private workspace for turning conversations into reliable working records across domains. Speech recognition runs on the user's device through whisper.cpp, with local transcript storage and optional local analysis. The founder's library and archival experience informs attention to context, source traceability, retrieval, and preservation of meaning; these principles serve every user, not only information professionals.

## Operating Context

Users work with meetings, interviews, calls, and other professional recordings. They need to import audio, select or detect Bahasa Indonesia and English, monitor local processing, review timestamped text, search and edit the result, and export it for use in other enterprise tools.

## Cross-domain Workflows

These are intended uses to guide product development and validation, not claims that dedicated sector features already exist.

| Domain or function | Example recordings | Intended useful outputs |
| --- | --- | --- |
| Legal | Client interviews, case discussions, recorded proceedings | Reviewed transcripts, source-linked quotations, draft chronologies |
| Media | Interviews, press conferences, production discussions | Checked quotations, interview transcripts, subtitles, editorial notes |
| Education | Lectures, seminars, research interviews | Searchable learning material, study notes, research transcripts |
| Public sector | Consultations, briefings, coordination meetings | Draft minutes, documented decisions, action items |
| Private sector | Project meetings, client conversations, operational reviews | Meeting records, decision summaries, follow-up lists |
| Human resources | Recruitment interviews, training, employee discussions | Reviewed interview notes, training records, follow-up summaries |
| Corporate secretariat | Board, committee, and governance meetings | Draft minutes, resolutions for review, action registers |
| Public communication | Press briefings, stakeholder interviews, public consultations | Verified quotations, briefing drafts, issue summaries |
| Libraries and archives | Oral histories, recorded collections, institutional interviews | Searchable transcripts, contextual descriptions, discovery aids |

Build a shared foundation: import, transcribe, identify speakers, review against timestamps, correct, search, analyze, and export. Add domain-specific templates where user research shows a need. Broad applicability should come from flexible outputs and clear language rather than requiring users to navigate a separate application for each profession.

Generated summaries and drafts remain connected to the reviewed transcript. Users decide what becomes an approved record or public communication. Preserve the distinction between original speech, user edits, and generated interpretation.

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
- Preserve context and distinguish original speech, edits, and generated interpretation.
- Support different domains through a common, approachable workflow and adaptable outputs.
- Treat Bahasa Indonesia and English as equal first-class workflows.
- Communicate model, browser, and hardware constraints plainly.

## Accessibility & Inclusion

The professional workflow must be keyboard-operable, screen-reader legible, responsive, and usable with reduced motion. Status and language must never be conveyed by color alone.

## Implemented foundation — September 2026

The reviewed-record increment adds opt-in local FFmpeg preparation up to 2 GiB (browser decoding remains 250 MiB), analysis passage references with retained source excerpts and available timestamps, and local DOCX exports for workspace transcripts, saved dialogue, and analysis. Results remain drafts for human review. The four-hour audio limit and browser memory constraints still apply.

The next increments are durable batch recovery, correction history and review status, projects and contextual metadata, domain glossaries and templates, reviewed redaction, portable backup, and guided setup. Dedicated HR, legal, governance, and communication workflows should build on those shared foundations; these sector-specific capabilities are not yet implemented.
