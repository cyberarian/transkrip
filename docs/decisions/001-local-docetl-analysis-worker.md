# ADR 001: Optional local DocETL analysis worker

- Status: Accepted
- Date: 2026-08-17

## Context

Transkrip already stores owner-scoped completed transcripts and uses local Ollama for explicit text correction. Users need structured meeting minutes, action-item extraction, and synthesis across several transcripts without weakening the device-local privacy model or making transcription depend on a large Python stack.

DocETL is Python-native, has a Frame API for map/reduce document processing, and can use Ollama through LiteLLM. Running it inside Node or allowing it to read SQLite would blur tenant and failure boundaries. Running automatic analysis on every transcript would add latency, memory pressure, and an unexpected secondary use of private text.

## Decision

DocETL is an optional, explicit Analysis feature behind an authenticated Node API.

- Node remains the only process allowed to read SQLite and enforces owner scope before selecting source text.
- A loopback-only Python worker on `127.0.0.1:8770` receives only 1–8 explicitly selected completed transcripts.
- Node persists `analysis_runs`, queues jobs sequentially, limits admission to two active runs per owner and eight globally, and stores structured results or sanitized failures for the requesting owner.
- The worker uses DocETL 0.3.0 with the Frame API, local Ollama only, one thread, bounded input/output, deterministic prompts, and optimization disabled.
- Transcript content is treated as untrusted data. Prompts forbid following instructions embedded in a transcript and forbid unsupported facts.
- DocETL input, intermediate output, and model cache use process-owned temporary storage. Only non-content font metadata may persist in the ignored project cache.
- The app starts and remains useful without the optional environment. Readiness is visible and retryable.
- Top-level navigation labels are English; explanatory product content remains Bahasa Indonesia.

## Consequences

The privacy and tenant boundary stays centralized in Node, tab navigation does not cancel persisted jobs, and a 16 GB host avoids concurrent DocETL/Ollama pressure. Users must install an optional Python environment, and local analysis with an 8B model can take tens of seconds. Results remain model-generated drafts that require human review. Cross-process jobs interrupted by a full Node restart are recovered as failed rather than silently resumed.

## Alternatives considered

- Automatic analysis after transcription: rejected because it spends compute and reuses text without a separate user action.
- DocETL reading SQLite directly: rejected because it duplicates authorization and broadens database access.
- Running arbitrary user-authored DocETL pipelines: rejected because it expands the execution and prompt-injection surface.
- Cloud document processing: rejected because it violates the current local-only product boundary.
