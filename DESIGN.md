---
name: Transkrip
description: A private bilingual transcript review workstation built as a monochromatic cobalt proof sheet.
colors:
  night-ink: "#030b18"
  console-ink: "#07152b"
  raised-ink: "#102d52"
  reading-light: "#e8f1ff"
  reading-paper: "#f2f7ff"
  paper-ink: "#07152b"
  command-cobalt: "#1759b8"
  signal-blue: "#287bd1"
  waveform-blue: "#5a9ee0"
  privacy-blue: "#8dbce8"
  action-tint: "#b9d7f5"
  muted-steel: "#86a9ca"
  major-grid: "#6d94bb"
  panel-grid: "#3b638a"
typography:
  display:
    fontFamily: "Chivo Mono, ui-monospace, monospace"
    fontSize: "clamp(2rem, 5vw, 3.8rem)"
    fontWeight: 700
    lineHeight: 1.03
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Chivo Mono, ui-monospace, monospace"
    fontSize: "1rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "0.02em"
  body:
    fontFamily: "Atkinson Hyperlegible Next, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  modern-reading:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  classic-reading:
    fontFamily: "Iowan Old Style, Palatino Linotype, Book Antiqua, Palatino, Georgia, serif"
    fontSize: "1.06rem"
    fontWeight: 400
    lineHeight: 1.65
  preset-sample:
    fontFamily: "preset reading family"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.5
  landing-lead:
    fontFamily: "selected reading family"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.65
  landing-display:
    fontFamily: "selected editorial family"
    fontSize: "clamp(2.8rem, 6.4vw, 6rem)"
    fontWeight: 700
    lineHeight: 0.96
    letterSpacing: "-0.04em"
  label:
    fontFamily: "Chivo Mono, ui-monospace, monospace"
    fontSize: "0.73rem"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  cell: "0px"
spacing:
  hairline: "6px"
  shell: "8px"
  cell: "12px"
  control: "16px"
  panel: "24px"
  drawer: "56px"
components:
  button-command:
    backgroundColor: "{colors.command-cobalt}"
    textColor: "{colors.reading-paper}"
    typography: "{typography.body}"
    rounded: "{rounded.cell}"
    padding: "0 22px"
    height: "48px"
  button-action:
    backgroundColor: "{colors.action-tint}"
    textColor: "{colors.console-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.cell}"
    padding: "0 22px"
    height: "48px"
  field-search:
    backgroundColor: "transparent"
    textColor: "{colors.reading-light}"
    typography: "{typography.body}"
    rounded: "{rounded.cell}"
    padding: "7px 9px"
  model-ledger-selected:
    backgroundColor: "{colors.command-cobalt}"
    textColor: "{colors.reading-paper}"
    typography: "{typography.body}"
    rounded: "{rounded.cell}"
    height: "82px"
  save-bar-action:
    backgroundColor: "{colors.action-tint}"
    textColor: "{colors.console-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.cell}"
    padding: "8px"
    height: "62px"
---

# Design System: Transkrip

## Overview

**Creative North Star: "The Cobalt Proof Sheet"**

Transkrip is an Operate-mode review workstation modeled on professional proofing instruments rather than contemporary upload dashboards. One cobalt hue spans near-black console ink, mid-tone controls, steel-blue metadata, and pale blue-white transcript paper. Visible grid lines, ordered dithering, and square cell controls make the interface dense, immediate, and legible under sustained use.

The visual hierarchy follows the work itself. Command and playback regions occupy the top, pale proof paper carries editable transcript text, and a dark pinned inspector preserves the link between a selected utterance and its audio evidence. Luminance, borders, pattern, icons, and explicit words carry state; hue never does that work alone.

**Key Characteristics:**

- Fixed-region workstation composition with explicit borders and compact gaps.
- Dark cobalt-black console surfaces surrounding one high-contrast blue-white reading field.
- Square controls, hard edges, inverted active states, and stepped state motion.
- Chivo Mono for machine state and data; Atkinson Hyperlegible Next for sustained reading and editing.
- Ordered dithering and pixel motifs used sparingly as a computer-screen signature.

## Colors

The palette uses only one blue hue family. Contrast is created through shades, tints, and tones rather than unrelated semantic colors.

### Primary

- **Command Cobalt:** Owns selected controls, primary local actions, active-row rails, and interaction emphasis.

### Secondary

- **Signal Blue:** Marks waveform evidence, timestamps, and active controls.
- **Action Tint:** The palest actionable blue, reserved for consequential execution and keyboard focus.
- **Privacy Blue:** A high-luminance blue paired with shield icons and explicit local-only wording.

### Neutral

- **Night Ink, Console Ink, and Raised Ink:** Form the dark shell, panel field, and hover layer.
- **Reading Light and Reading Paper:** Carry light-on-dark copy and the sustained transcript-reading surface.
- **Paper Ink:** Provides long-form text and hard borders on pale blue surfaces.
- **Muted Steel:** Supports secondary status copy without competing with live evidence.
- **Major Grid and Panel Grid:** Separate major regions and internal dark-panel rows respectively.

### Named Rules

**The One-Hue Rule.** Every authored UI color stays within the cobalt-blue family. State differences use luminance, pattern, weight, iconography, position, and text.

**The One Paper Rule.** The transcript and setup work surfaces may use pale blue proof paper; surrounding command and evidence regions remain ink-dark.

## Typography

**Default Display Font:** Chivo Mono (with ui-monospace and monospace fallbacks)  
**Default Body Font:** Atkinson Hyperlegible Next (with ui-sans-serif, system-ui, and sans-serif fallbacks)  
**Label/Mono Font:** Chivo Mono

**Character:** Chivo Mono gives controls, timers, headings, and machine state an engineered display cadence. Atkinson Hyperlegible Next keeps bilingual transcript editing comfortable and distinct at compact sizes.

### Hierarchy

- **Display:** Bold, tightly tracked, and used only for the setup-drawer statement.
- **Title:** Compact mono panel headings and workstation identity.
- **Body:** Regular-weight transcript text, explanations, and editable content with generous leading.
- **Label:** Small mono metadata, timestamps, counters, and uppercase field labels.

### Named Rules

**The Data Has a Face Rule.** Time, state, language metadata, and control labels use the mono voice; sentence-level transcript content uses the reading voice.

### User-selectable reading presets

Settings exposes three device-local presets without changing monochrome semantics, square control geometry, evidence hierarchy, or focus treatment. **Evidence Console** is the default pairing above. **Modern Editorial** uses the operating system's sans-serif stack for reading and editorial headings. **Classic Typesetting** uses an old-style local serif stack—preferring Iowan Old Style, Palatino, and Georgia—for sustained transcript reading. Chivo Mono remains authoritative for time, status, language, identifiers, and machine state in every preset.

The choice applies at the document root and persists only in browser local storage. Do not add a remote font stylesheet, font CDN, tracking request, or runtime font download. Missing system faces must degrade through the declared local fallback stack, and an invalid saved preset must return to Evidence Console.

## Layout

Authentication adds two bounded layouts without changing the workstation grammar. The login checkpoint uses a split proof-sheet composition at wide widths and a single column on compact screens. The account-management ledger keeps creation controls above the account rows; expanded editing controls become a single readable column below 600px. The authenticated account bar remains above route navigation so identity, role, account administration, and logout are always explicit.

The desktop shell is a full-height grid with four fixed regions: command bar, audio deck, review split, and status strip. Eight-pixel shell padding and six-pixel gutters keep panels separate while retaining the feel of one screen. The review area uses a roughly 3:1 transcript-to-evidence split; the transcript owns the work while the inspector remains continuously available.

At 900px and below, the command bar becomes two columns and the inspector stacks below the transcript. At 600px and below, exterior gaps disappear, the command bar becomes a single column, secondary labels collapse, transcript columns narrow, and the drawer retains an eight-pixel screen inset. Density changes without changing the region order.

Settings routes preserve the same bounded-region logic while accommodating long device inventories. Their command ledger becomes a two-by-two grid at 600px and below, retaining brand, local scope, document identity, and return action in the first viewport. The save state remains fixed to the lower screen edge while inventory rows scroll, and content reserves enough lower space that the bar never conceals the final record.

The landing route uses a transcript-first proof composition rather than a generic feature-card grid. Its first viewport pairs one decisive product statement with an inspectable bilingual transcript artifact, then moves through the local-data boundary, three-stage workflow, and typography selection. At 900px the statement and proof stack; at 600px command cells, proof rows, workflow steps, and typography choices become single-column without hiding the primary workspace action.

**The Fixed Region Rule.** Preserve command, audio, transcript, evidence, and status as visibly bounded regions; do not dissolve them into floating cards.

**The Persistent Commitment Rule.** When a Settings choice may sit below a long inventory, keep both the saved value and its commit action continuously reachable at the lower viewport edge.

## Elevation & Depth

The workstation is flat by default. One-pixel strokes, tonal changes, inset rails, and inverted fills express hierarchy. The setup drawer is the only floating plane: it uses a hard dark border, a directional cast shadow, and a dotted pale-blue scrim to declare modal interruption. Model-selection cells use inset shadow as tactile depth, not ambient softness.

### Shadow Vocabulary

- **Active rail:** An inset cobalt edge marks the selected transcript row.
- **Pressed cell:** A dark inset lower-right edge makes the brand and model cells feel keyed into the screen.
- **Drawer cast:** A strong down-left separation belongs only to the setup drawer.

### Named Rules

**The Flat Workstation Rule.** No routine panel or control receives a soft card shadow; borders and inverted state fills carry structure.

## Shapes

All controls, panels, fields, tags, indicators, and drawers use square corners. One-pixel strokes define ordinary cells; two-pixel strokes are reserved for the brand mark, model drop target, and modal boundary. Pixel clipping and ordered-dither blocks may create stepped silhouettes, but rounded pills and soft cards do not belong to this world.

### Brand mark

The Transkrip symbol is a custom capital **T** built from one continuous, hard-edged geometry. Its stepped crossbar reads as a compact three-beat waveform; the long stem resolves as a text cursor; two rectangular counters create quotation-like negative space without becoming a speech bubble. In product headers, the Action Tint symbol sits inside a 34-pixel Command Cobalt keyed cell with a two-pixel Reading Paper border and dark lower-right inset. The exact lowercase wordmark **transkrip** uses Chivo Mono with tight optical tracking.

Use that compact lockup consistently in route headers, the login checkpoint, and the landing command ledger so the local workstation is identified in the first viewport. Use the standalone mark for the SVG favicon and app-icon contexts. It must remain flat, monochrome, square, and recognizable at 16 px. Never redraw it as a microphone, place it in a rounded app tile, add gradients or ambient shadows, or replace the lowercase wordmark with uppercase display text.

**The Voice-to-Text Mark Rule.** Preserve the stepped waveform crown, cursor stem, and both quote-like counters as one continuous path; these three readings are the identity, not optional decoration.

## Components

### Buttons

- **Shape:** Square bordered cells with no radius.
- **Primary:** Cobalt fill with light copy for navigation and evidence actions; Action Tint with dark copy for the main transcription action.
- **Hover / Focus:** Hover shifts dark controls to Raised Ink. Keyboard focus uses a three-pixel inset Action Tint outline so it remains visible without changing layout.
- **Disabled:** Muted blue-gray copy, unchanged geometry, and a non-interactive cursor.

### Chips

- **Style:** Language tags are compact square cells with centered mono abbreviations. Their visible ID, EN, and AU text is authoritative; blue luminance steps provide secondary differentiation.
- **State:** Selection is expressed on the transcript row, not by rounding or enlarging the tag.

### Cards / Containers

- **Corner Style:** Hard rectangular regions.
- **Background:** Ink for command and evidence regions; paper for transcript work.
- **Shadow Strategy:** Flat except for the modal drawer.
- **Border:** Lighter blue grid strokes between major regions and darker blue strokes within dark panels.
- **Internal Padding:** Compact control padding; larger panel and drawer padding only where reading or setup requires it.

### Inputs / Fields

- **Style:** Square, transparent or surface-matched fields with a single visible stroke. Transcript textareas disappear into the paper until active.
- **Focus:** Action Tint inset outline for general controls; transcript editing uses a lighter paper fill and cobalt bottom rail.
- **Error / Disabled:** Errors use explicit recovery copy, stronger borders, and a dark-blue error surface; disabled controls retain structure but reduce contrast.

### Navigation

- The authenticated account bar shows display name, normalized username, role, an admin-only account-management action, and logout.
- Account administration is not shown to standard users. Server authorization remains authoritative even when a control is absent.

The command bar is cell-based rather than link-based: brand, privacy status, language selector, and model state each occupy a bordered grid cell. Active transport controls invert to a bright fill. On narrow screens, cells stack in reading order without becoming a separate mobile navigation pattern.

Secondary documents enter through a dedicated command-bar cell and keep the console grammar after routing. Their header repeats the brand and local-system state, identifies the active document, and ends with a pale-blue return cell; a compact ink footer may repeat the same return action for long ledger pages. Route changes must not introduce a detached marketing nav, rounded tabs, or a second visual shell.

### Transcript Segment

Each row aligns a square language selector with editable body copy. Transcript paragraphs omit timestamps, use justified reading text, and retain timing only as internal audio evidence. The active row inverts to a cool pale field with a cobalt left rail and a faint ordered-dither corner, visibly tying it to the evidence inspector.

### Setup Drawer

The drawer is a pale-blue interruption plane with an oversized mono title, dotted ordered raster, square close cell, and a deep cobalt model drop target. Its model list distinguishes the recommended bilingual default from the high-memory, Bahasa-only optimized option. It is the single composition allowed to float above the workstation.

### Runtime and Release Ledgers

Inspectable system facts use paired, dark ledger regions rather than promotional cards. Runtime rows combine a zero-padded mono index, a named layer, its implementation, a short operational detail, and a textual local-state mark; release rows pair stable artifact labels with exact approved values. Keep both ledgers flat, divided by blue one-pixel rules, and place any privacy boundary in an explicit deep-and-light blue block below the records.

### Settings Inventory Ledger

### Local Access Checkpoint

The login checkpoint is a first-class privacy boundary, not a marketing card. It uses a labeled username field, password field, persistent local-only explanation, generic credential failures, and a single command action. It must not reveal whether a username exists.

### Account Management Ledger

Administrators create accounts in a compact header form and expand one ledger row at a time for edits. Role, enabled state, display name, and optional replacement password stay visibly separate. Permanent deletion requires typing the exact username, while disabling remains the non-destructive default. Protected last-administrator and self-deletion states are explained in text and never rely on color alone.

Device-discovered options use full-width dark ledger rows rather than cards or a native select. Each row combines a zero-padded index, a square empty-or-checked selection mark, the primary identifier, available build metadata, reported size, and a textual availability or recommendation verdict. A selected row uses paper-colored metadata on Command Cobalt with an Action Tint inset rail; the visible word “Dipilih” remains present so the state is never communicated by fill or checkmark alone.

Place the page statement and a scoped deep-and-light blue privacy boundary before the inventory. Privacy copy must name exactly what the route reads locally and when transcript content may later reach the local model; it must not broaden that evidence into an unsupported claim about unrelated routes. Loading, empty, and connection-error states occupy the same ledger region and preserve the saved choice. End with a fixed save bar that names the currently saved model and distinguishes a pending choice from “Pilihan tersimpan.”

## Do's and Don'ts

### Do:

- **Do** preserve the fixed-region hierarchy and the transcript/evidence relationship.
- **Do** use luminance, text, icons, line weight, and pattern together for semantic signals.
- **Do** keep status, language metadata, and compact headings in Chivo Mono while transcript paragraphs use the reading face.
- **Do** use hard borders, inversion, and inset rails to show interaction state.
- **Do** use the exact 34-pixel keyed brand lockup in first-viewport route, login, and landing headers, and the standalone mark as the favicon.
- **Do** pair square selection marks with explicit selected-state copy in device inventory ledgers.
- **Do** keep step-based motion minimal and honor reduced-motion preferences.

### Don't:

- **Don't** turn the interface into a consumer upload-card dashboard.
- **Don't** introduce rounded pills, glass surfaces, gradients, or generic soft card shadows.
- **Don't** use dithering as a full-screen texture; reserve it for local signature moments.
- **Don't** alter the mark's continuous path, remove either quote-like counter, or change the lowercase **transkrip** wordmark.
- **Don't** place long transcript sentences in the mono display face.
- **Don't** communicate privacy, language, readiness, or error with color alone.
