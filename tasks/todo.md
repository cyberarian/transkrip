# Production Readiness Checklist

## Searchable local knowledge workflow

- [x] Owner-scoped FTS5 migration indexes filename, raw text, and corrected text without duplicating canonical records.
- [x] Search API validates query/filter/pagination bounds and returns only authenticated-owner excerpts.
- [x] Tasks UI supports accessible search, clear/reset, loading, empty, and error states across phone and desktop layouts.
- [x] Analysis runs persist real pipeline phases from the loopback request lifecycle; counters and heartbeats remain a future streaming-worker enhancement.
- [ ] Long-running analysis shows truthful section milestones; stalled work becomes an explicit recoverable error.
- [ ] Versioned encrypted owner backup, reviewed action items, and grounded Q&A remain later vertical slices.
- [x] Phase A automated checks, responsive browser QA, implementation notes, and tenant-boundary review pass.

## Multi-tenant accounts and RBAC

- [x] Approve bootstrap and legacy-data ownership assumptions in `tasks/spec-multitenant-rbac.md`.
- [x] Add tested users/sessions schema, credential hashing, and legacy ownership migration.
- [x] Require sessions and owner predicates on every transcription API operation.
- [x] Add owner-only transcription deletion and admin-only account CRUD.
- [x] Add protected login/application shell and admin account-management UI.
- [x] Update README/production guidance and pass automated plus two-user browser isolation checks.

## Speaker diarization and bilingual dialogue

- [x] Existing histories migrate into canonical audio/language/raw/formatted/speakers fields.
- [x] pyannote Community-1 is optional, loopback-only, and has a one-speaker fallback.
- [x] Temporary WAV files are bounded and removed on success, error, malformed finalize, and startup.
- [x] Speaker blocks are editable and speaker names rename globally across the document.
- [x] Bilingual Ollama normalization persists structured blocks without changing speaker identity.
- [x] Desktop/mobile QA, full checks, and independent finish review pass.

## Local transcription history

- [x] SQLite file is created locally with the required fields and timestamps.
- [x] API validation, limits, prepared statements, and privacy-safe logs are verified.
- [x] Incoming segments are appended transactionally and task completion is persisted.
- [x] Task rows expand into an editor and save/correct actions synchronize immediately.
- [x] The selected Settings model is used by the server-side local Ollama endpoint.
- [x] README and production guidance describe backup, database location, and loopback runtime.

## Task 1: Reproducible quality gates

**Acceptance criteria:**
- [ ] Exact dependency versions and package manager are declared.
- [ ] `npm run check` runs lint, tests, type checking, and build.
- [ ] Production dependency audit has no high/critical finding.

**Verification:** `npm ci --ignore-scripts`, `npm run check`, `npm audit --omit=dev --audit-level=high`

## Task 2: Local privacy boundary

**Acceptance criteria:**
- [ ] No page-load request targets a third-party origin.
- [ ] CSP limits connections and assets to the application origin.
- [ ] Documentation accurately discloses optional loopback Ollama transcript processing.

**Verification:** source scan, production browser network inspection, privacy regression test

## Task 3: Runtime correctness and resilience

**Acceptance criteria:**
- [ ] Resource limits reject unsafe audio/model inputs before allocation.
- [ ] Media time and SRT formatting remain valid at boundaries.
- [ ] Worker requests cannot overlap or accept malformed messages silently.

**Verification:** focused unit tests, lint, type check, production build

## Task 4: Accessible browser workflow

**Acceptance criteria:**
- [ ] Waveform seeking is keyboard operable.
- [ ] Setup dialog handles initial focus, Escape, and focus return.
- [ ] Dynamic progress/status text is exposed without duplicate announcements.

**Verification:** real-browser keyboard, accessibility-tree, console, and responsive checks

## Task 5: Release handoff

**Acceptance criteria:**
- [ ] Required security/isolation headers and local proxy are documented.
- [ ] Release asset checksums can be generated locally.
- [ ] Readiness verdict, residual risks, smoke test, and rollback steps are recorded.

**Verification:** documentation review and final `npm run check`
