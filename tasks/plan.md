# Production Readiness Plan: Transkrip

## Current feature: searchable local knowledge workflow

Implement the Daedalus Echo-inspired capabilities that fit Transkrip's professional, bilingual, local-first scope without copying Android-specific code or weakening tenant and loopback boundaries.

### Phase A: Search and truthful analysis progress

- [x] Add owner-scoped SQLite FTS5 indexing for filenames, raw transcripts, and corrected transcripts.
- [x] Add a bounded, paginated search API and a responsive Tasks search/filter surface with useful excerpts.
- [x] Persist real DocETL pipeline phases instead of inferring activity from elapsed time. Section counters and heartbeats remain deferred until the worker supports streamed milestones.
- [x] Recover stale analysis runs visibly and retain the existing one-job local resource policy.

### Checkpoint: Phase A

- [x] Cross-tenant search and malformed FTS queries fail closed.
- [x] Analysis status survives route changes and reports real worker milestones.
- [x] Focused database/API/UI tests and the full `npm run check` gate pass.

### Phase B: Recovery and actionable output

- [ ] Add versioned, owner-only backup export plus validated dry-run restore.
- [ ] Add optional passphrase encryption without persisting the passphrase.
- [ ] Add reviewed action-item proposals and owner-scoped CRUD linked to transcript evidence.

### Phase C: Grounded retrieval

- [ ] Add explicit FTS-grounded questions over selected transcripts with task/timestamp citations.
- [ ] Evaluate optional multilingual local embeddings only after lexical retrieval is proven useful.
- [ ] Defer mind maps and reject always-on listening or automatic post-transcription AI processing.

### Architecture decisions

- Node remains the only SQLite authority and every query carries `owner_user_id`.
- Search uses prepared statements and a conservative literal-token query builder; raw FTS syntax is not accepted from browsers.
- FTS indexes are derived data rebuilt from canonical transcription rows and removed through database lifecycle operations.
- DocETL remains optional, loopback-only, bounded, and explicitly invoked; worker progress contains metadata only, never transcript excerpts.
- Additive API fields preserve existing clients and incomplete later phases are not exposed.

### Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| FTS query syntax can trigger errors or expensive evaluation | High | Convert bounded user terms into quoted literal-prefix clauses and parameterize MATCH values |
| FTS results can cross tenant boundaries | High | Join canonical rows and require owner scope before ranking or excerpting |
| Progress polling can create excessive SQLite writes | Medium | Persist stage changes and bounded heartbeats, not every UI timer tick |
| Long analysis input can overload a 16 GB host | High | Preserve sequential execution and split only at bounded document/speaker boundaries |
| Backup/restore can overwrite owner data | High | Dry-run validation, explicit conflict policy, transaction, and encrypted owner-only archives |

## Proposed feature: multi-tenant accounts and RBAC

Specification: `tasks/spec-multitenant-rbac.md`

- [x] Add users, sessions, password hashing, bootstrap validation, and legacy ownership migration.
- [x] Owner-scope the transcription repository and add safe delete semantics.
- [x] Add authentication/session middleware, account-management endpoints, CSRF defense, and RBAC tests.
- [x] Add login/session state, protected routes, user administration, account menu, and owner task deletion.
- [x] Update operations documentation; run full automated and two-user browser isolation checks.

Risk checkpoints: bootstrap must fail closed; legacy data must remain recoverable; cross-tenant IDs must disclose nothing; last-admin invariants must be transactional.

## Current feature: local transcription history

- [x] Add the constrained SQLite repository and loopback HTTP API.
- [x] Add behavior tests for schema, atomic segment append, edits, and model correction.
- [x] Persist incoming Whisper segments and completion state from the workspace.
- [x] Add the `#tasks` table/editor route with immediate row synchronization.
- [x] Update local deployment, privacy, architecture, and recovery documentation.
- [x] Complete automated checks, responsive browser QA, and final code/design review.

## Current feature: speaker diarization and dialogue normalization

- [x] Migrate existing SQLite rows to the bilingual speaker-document schema.
- [x] Add local audio staging, pyannote sidecar, speaker alignment, and safe fallback.
- [x] Persist structured speaker blocks and whole-document speaker renames.
- [x] Normalize each dialogue turn with the selected local Ollama model.
- [x] Verify data migration, API limits, browser editing, responsive layout, and local privacy.

## Overview

Audit and harden the local-first transcription application without adding telemetry, cloud storage, external identity services, or third-party data processing. Local administrator-managed accounts isolate each user's work inside the device-local SQLite database. The production boundary is the browser plus optional loopback-only Ollama access through a same-origin local proxy.

## Architecture Decisions

- Keep transcription, audio decoding, models, and transcript state session-local.
- Remove implicit internet access from the UI and enforce a restrictive browser content policy.
- Treat bundled model/runtime artifacts as release assets with documented integrity and hosting requirements.
- Add reproducible quality gates before changing behavior: pinned tooling, lint, tests, build, and dependency audit.

## Task List

### Phase 1: Baseline and supply chain

- [x] Inventory application code, assets, dependencies, and data-flow boundaries.
- [ ] Pin the package manager and dependency versions; classify build tooling as development-only.
- [ ] Add working lint and test commands with focused regression coverage.

### Checkpoint: Foundation

- [ ] Clean install is reproducible with dependency scripts disabled.
- [ ] Lint, tests, type checking, and build pass.
- [ ] No reachable high/critical production dependency advisory remains.

### Phase 2: Privacy and runtime hardening

- [ ] Remove remote font requests and block unexpected network destinations with CSP.
- [ ] Add safe input/resource limits, object URL cleanup, time clamping, and valid SRT formatting.
- [ ] Harden worker message validation and prevent overlapping engine operations.
- [ ] Improve keyboard, dialog, and status accessibility without changing the visual system.

### Checkpoint: Runtime

- [ ] Critical local workflow loads in a real isolated browser with a clean console.
- [ ] Browser network activity is limited to same-origin assets and explicit loopback Ollama use.
- [ ] Desktop and mobile layouts remain usable.

### Phase 3: Release operations

- [ ] Document deploy headers, local proxy requirements, asset checksums, verification, and rollback.
- [ ] Add repository ignore rules and a production-readiness report with residual risks.
- [ ] Re-run all automated and browser checks against the production build.

### Checkpoint: Complete

- [ ] All remediated acceptance criteria pass.
- [ ] Any remaining release blockers are explicit and actionable.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Multi-gigabyte model assets make builds and deployment costly | High | Exclude the unused F16 model from browser releases and publish checksums |
| Browser memory exhaustion on large files/models | High | Enforce conservative file limits and preserve quantized model guidance |
| Local Ollama correction is unavailable on generic static hosting | Medium | Require a documented same-origin loopback proxy; fail closed |
| No existing test or lint harness | High | Add minimal pinned tooling and behavior-focused tests |
| Parent directory is the Git root | Medium | Confine changes to `transkrip` and do not commit sibling projects |

## Open Questions

- The final production host/runtime is not specified. The repository will document required headers and proxy behavior, but host-specific deployment automation remains a release-owner decision.

## Current increment: reviewed-record workflow (2026-09-14)

User authorized the recommended next release: more reliable media preparation, evidence-linked analysis, and DOCX export. Apply the shared workflow across the domains in PRODUCT.md.

1. Evidence: create immutable passage snapshots from owner-authorized transcripts; give each a generated reference; preserve model citations; validate references against the input snapshot; render links to the exact text/timestamp. Old results remain readable and explicitly lack references. Source membership is validated, but semantic entailment remains a user review task.
2. Documents: lazily load a maintained DOCX writer; export workspace transcripts, saved speaker documents, and analysis with evidence. Preserve bilingual text, paragraphs, and timestamps; do not change source records during export.
3. Preparation: add an explicitly selected loopback FFmpeg mode for files up to 2 GB, with streamed input hashing, temporary files, bounded output/time/concurrency, and cancellation. Browser decoding remains default. Recognition stays in the browser. No media URLs, supplied filesystem paths, or network-enabled FFmpeg input protocols.
4. Verification: focused TS/Node/Python tests, real FFmpeg audio/video fixtures and cancellation, browser desktop/mobile/download checks, then repository check gate.

Later increments retain the broader suggested roadmap: persistent batch transcription metadata and file reselection recovery; review/revision history; projects/metadata; glossary; templates; redacted copies; backup/restore; easier installation. This increment does not claim those are shipped.

Documentation must distinguish the existing 250 MB browser limit from the optional 2 GB local preparation input limit. Both modes retain a four-hour decoded-audio limit and device-memory constraints. Temporary conversion changes the prior browser-only decoding boundary and must be visible before import.
