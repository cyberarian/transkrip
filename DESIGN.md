# Transkrip — Conversation Studio

The redesigned interface is a daylight studio for professionals reviewing private Bahasa Indonesia and English recordings. It replaces the cobalt proof-sheet console with a calm, light workspace, while preserving local processing, account boundaries, existing routes, and editing capabilities.

## Visual system

- Canvas: `#f4f6f9`; surfaces: white; navigation: `#f9fafc`.
- Primary ink: `#182b45`; secondary text: `#607086`; borders: `#dce3ed`.
- Action blue: `#245edb`, with white action labels; selected surfaces: `#e6edfc`.
- Atkinson Hyperlegible Next owns headings and reading. Chivo Mono remains for timestamps and machine data. Existing modern and classic reading preferences remain available. Fonts are bundled locally.
- Panels have 12px corners; controls 8px; navigation rows 46px. Borders separate regions; elevation is reserved for the transcript preview and setup drawer.

## Composition and interaction

A persistent navigation rail connects Workspace, Tasks, Analysis, Settings, and About. The account strip retains identity, local model status, administration, and logout. The rail narrows on tablets and becomes labeled top navigation on phones. Active routes use `aria-current` as well as color and weight.

The workspace prioritizes audio, transcript, and supporting evidence in that order. Primary actions use solid blue. Empty states describe the next step and retain upload and illustrative preview actions. The audio waveform uses a dark navy surface to keep the recording legible. Settings retain their persistent save controls.

The sign-in page pairs a blue-tinted product introduction with a bounded form. Its decorative sound bars are hidden from assistive technology; no sample recording is implied.

## Accessibility and boundaries

Keep visible keyboard focus, readable labels, native form controls, and reduced-motion support. Small layouts stack content instead of shrinking controls. AI means the existing local analysis and correction tools; never imply a cloud assistant or unsupported automation.

Implementation lives in `src/studio.css`, loaded after the incumbent component stylesheet to preserve existing user-staged styling. Future component work should consolidate migrated styles deliberately. The new direction uses seed `ce3c44c2` and the user's authorization to proceed without design approval rounds.
