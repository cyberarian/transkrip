# Transcription workspace

- Mode: Operate
- Audience: professional users reviewing Bahasa Indonesia and English workplace recordings
- Task: import local audio, transcribe on-device, review timestamped text against audio evidence, edit, search, and export
- Constraints: no audio or transcript data leaves the device; browser and memory limitations must be explicit
- Direction: Sixteen-Color Field; fixed regions, ordered dithering, bordered row controls, active-cell inversion
- Approved composition: `.impeccable/mocks/review.png`
- Memorable moment: selecting a transcript segment synchronizes the waveform playhead and the evidence inspector

## Implementation inventory

| Comp commitment | Medium |
| --- | --- |
| Fixed top command and transport strip | Semantic HTML/CSS |
| Audio waveform and synchronized playhead | Canvas with accessible controls |
| Dominant editable transcript rows | Semantic HTML inputs and buttons |
| Evidence inspector for active segment | Semantic HTML/CSS |
| Sixteen-color palette and ordered dithering | CSS tokens and pixel pattern |
| Bottom session strip on wide screens | Semantic navigation; collapses to select on mobile |
| Icons | Authored SVG React component |
| Local model status and browser capability | Web APIs and worker state |
