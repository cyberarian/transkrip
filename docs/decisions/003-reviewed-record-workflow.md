# Reviewed-record workflow

Date: 2026-09-14

## Scope

The first increment from PRODUCT.md and MARKET.md implements optional preparation of larger media, source-linked analysis, and DOCX exports. These shared capabilities support meetings, interviews, education, communication, and archival work without imposing a profession-specific interface.

## Decisions

- Keep browser decoding as the default (250 MiB). Explicitly enable a loopback-only FFmpeg service for files up to 2 GiB; both paths retain the four-hour duration limit. Recognition remains in the browser.
- Stream input to a private temporary directory while hashing. Decode the first audio track through a seekable inherited descriptor; allow only `fd` and `pipe` protocols and a fixed demuxer list. No client-supplied path, URL, shell command, or executable is accepted. Require FFmpeg 6+ with `fd` support. One job holds the preparation slot through response cleanup, with a ten-minute deadline and cancellation.
- Retain exact, authorized source snapshots with analysis results. Validate model passage references against those snapshots rather than trusting model-generated quotes. Use speaker-block times only when the selected corrected text matches the structured document. Reference validity is not semantic proof, human approval, or a tamper-evident audit record.
- Preserve compatibility with existing analysis JSON; old and uncited results show a review notice. Snapshots survive transcript edits/deletion until the analysis is deleted.
- Generate DOCX locally through a lazy-loaded `docx` module. Include speaker/time labels where available and internal links to analysis source bookmarks. No remote template, external image, or cloud document converter is involved.

## Operational limits

Allow disk space for the input plus up to 921.6 MB of output. Normal completion, failure, and cancellation delete temporary files. A killed process may leave files until preparation next runs. Run one service instance per staging directory. Ordinary deletion is not secure erasure.

The complete PCM still resides in browser memory alongside the speech model. Maximum accepted file size is not a memory guarantee. The browser's original-media player may not support a codec that FFmpeg can extract. Native browser decoding is cooperatively cancelled after decoding returns; FFmpeg work can be killed during conversion. Neither option provides a durable transcription queue or background execution after tab destruction.

## Verification

Automated checks exercise real FFmpeg WAV conversion, original-byte hashing, malformed/truncated inputs, size bounds, missing executable, cancellation cleanup and slot recovery; owner/origin checks; evidence validation and timestamp fallbacks; and Word ZIP/XML output with bilingual text and citation bookmarks. The full lint/test/type/build/asset gate passes. Browser smoke uses a separate temporary database and synthetic records, with no production transcript changes. See the media verification notes for observed fixture results.

## Next increments

Durable batch metadata and file reselection recovery; correction history and explicit review status; projects and metadata; domain glossaries; configurable domain templates; reviewed redaction; portable backup/restore; and guided setup. These remain planned features, not capabilities of this increment.

## References

- [FFmpeg protocol documentation](https://ffmpeg.org/ffmpeg-protocols.html): inherited file descriptors and protocol restrictions.
- [docx documentation](https://docx.js.org/): local OOXML generation.
