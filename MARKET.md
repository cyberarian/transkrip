# Transkrip market and competitor research

Research date: **14 September 2026**.

## Main finding

Transkrip's most credible positioning is **a private Bahasa Indonesia–English workspace for reviewing recordings and producing usable transcripts and analysis on the user's own device**. This is a positioning recommendation, not a demonstrated competitive advantage. Local transcription already exists in MacWhisper and Buzz; Indonesian and bilingual transcription already exist in commercial services. Transkrip needs evidence of easier review, dependable long-recording processing, and good Indonesian results to make that combination valuable. [MacWhisper](https://www.macwhisper.com/), [Buzz](https://github.com/chidiwilliams/buzz), [Notta bilingual documentation](https://support.notta.ai/hc/en-us/articles/23437010425755-Bilingual-transcription-translation-Web).

The strongest competitors sell an outcome beyond speech-to-text: less meeting administration, faster media production, searchable evidence, multilingual delivery, or predictable bulk processing. Transkrip should choose a clear customer workflow before attempting to match every feature.

## Scope and evidence

This review covers eleven comparable applications: direct local transcription tools, cloud recording workspaces, meeting assistants, production editors, human-assisted services, and an Indonesian specialist. It is a selected competitive landscape, not a market-share ranking or market-size estimate. Developer-only speech APIs and bundled meeting-platform features are outside the detailed comparison.

Sources are official product pages, help centers, pricing pages, and the Buzz repository. Vendor features are reported as advertised, not independently benchmarked. No competitor accounts were created and no recordings were uploaded. MacWhisper and TurboScribe were also inspected in a live browser. Salyns could not be reached directly; its entry relies on indexed official-page content and has lower confidence about current availability.

Prices and limits are snapshots, not quotes. Plan eligibility, tax, regional pricing, and terms can change. Accuracy percentages, customer counts, and testimonials are intentionally not used to rank products: no common test set or comparable measurement method was established.

Transkrip findings come from the current working tree: [README](README.md), [product requirements](PRODUCT.md), [audio decoder](src/audio.ts), [workspace](src/App.tsx), [analysis page](src/components/AnalysisPage.tsx), and [processing verification](docs/audio-processing-performance.md). Proposed capabilities below are not existing features.

## Market map

The “reason to choose” column is our interpretation of each product's documented offer, not evidence of customer purchasing behavior.

| Product | Main category | Reason to choose it | Relevance to Transkrip |
| --- | --- | --- | --- |
| MacWhisper | Local desktop transcription | Integrated Mac capture, transcription, batch workflows, and local AI options | Direct benchmark for a polished private workflow |
| Buzz | Open-source local transcription | Offline processing with desktop packages, acceleration options, and automation | Direct benchmark for local functionality and deployment |
| TurboScribe | Cloud file transcription | High-volume uploads with a simple paid offering | Strong large-file and bulk-processing benchmark |
| Otter | Meeting assistant | Live notes, shared meeting knowledge, and follow-up automation | Benchmark for meeting workflow convenience |
| Fireflies | Meeting intelligence | Conversation analytics and connections to business tools | Benchmark for turning transcripts into operational work |
| Notta | Multilingual meeting workspace | Bilingual capture across web, mobile, and meetings | Important Indonesian–English competitor |
| Sonix | Transcription and analysis workspace | Structured transcripts, cross-file analysis, and integrations | Benchmark for research and archive usability |
| Happy Scribe | Transcription, subtitles, and language services | AI output with optional professional human services | Benchmark for review and delivery quality |
| Descript | Audio/video production editor | Editing media through its transcript | Adjacent competitor for creators |
| Rev | Transcription and investigative intelligence | Human-reviewed services alongside evidence analysis | Benchmark for professional deliverables and provenance |
| Prosa Salyns | Indonesian transcription service | Bahasa Indonesia-focused recording and editing workflow | Regional competitor; availability needs rechecking |

Sources and qualifications for each row follow.

## What makes each product stand out

### 1. MacWhisper — a complete local Mac workflow

**Documented offer:** Local models, app-audio capture, meeting recording without a joining bot, batch transcription, watched folders, transcript editing, and multiple export formats. It also supports local AI services such as Ollama and optional remote providers. The direct website lists a free edition and Pro at **€64 per license, paid once**, with lifetime updates. [Official product and pricing](https://www.macwhisper.com/).

**Why it stands out:** Capture, processing, and follow-up work are integrated into desktop use. Users do not have to assemble the transcription engine and its supporting services themselves.

**Tradeoff and lesson:** Its primary product is Mac-specific. Privacy depends on selecting local functionality; cloud transcription sends media to servers. Transkrip can compete on a different deployment and language workflow, but cannot claim local transcription or local AI summaries as unique. [MacWhisper cloud/local clarification](https://docs.macwhisper.com/article/22-assistant).

### 2. Buzz — open-source local processing with automation

**Documented offer:** Offline Whisper transcription, audio/video and YouTube inputs, microphone transcription, speaker identification, multiple processing backends, GPU acceleration options, watched folders, CLI automation, and TXT/SRT/VTT exports. Its repository is MIT-licensed and documents Windows, Linux, and macOS installation; current Mac packages require Apple silicon. [Official repository](https://github.com/chidiwilliams/buzz).

**Why it stands out:** It makes a capable local processing pipeline available as an inspectable desktop application, including automation beyond individual file imports.

**Tradeoff and lesson:** Installation and acceleration differ by platform. Local software still depends on hardware and model setup. Transkrip needs to justify its browser-plus-services setup through a better review, history, or Indonesian workflow; open-source local recognition alone is already available.

### 3. TurboScribe — large files and straightforward bulk transcription

**Documented offer:** Its Unlimited plan advertises **5 GB and ten hours per file**, **50 files per upload batch**, and bulk exports. Listed pricing is **US$20 monthly** or **US$120 yearly**. Its free tier allows three files daily, each up to 30 minutes. It supports numerous audio/video containers, speaker recognition, and document/subtitle downloads. Files and transcripts are stored by the service. [Official offering and FAQ](https://turboscribe.ai/).

**Why it stands out:** Clear limits and a predictable subscription make it easy to assess for an archive of existing recordings.

**Tradeoff and lesson:** This requires uploading content. Its published capacity substantially exceeds Transkrip's current 250 MB/four-hour ceiling. Transkrip should make private large-file processing dependable before claiming suitability for heavy recording workloads.

### 4. Otter — ongoing meeting assistance

**Documented offer:** Live transcription, summaries, action items, shared channels, cross-meeting chat, CRM updates, and multiple capture methods, including desktop recording without meeting bots. [Official product page](https://otter.ai/).

**Why it stands out:** It treats transcription as part of meeting participation and follow-up, rather than a file conversion task.

**Tradeoff and lesson:** Its supported-language help page lists English, Spanish, French, German, Japanese, and Simplified Chinese; **Indonesian is not listed**. Chat translation is not the same as transcription support. This makes Otter a useful workflow reference but a less direct match for Indonesian recordings. Transkrip's current file-import workflow does not replace automatic meeting capture. [Official language support](https://help.otter.ai/hc/en-us/articles/360047247414-Supported-languages).

### 5. Fireflies — connecting conversations to business operations

**Documented offer:** Meeting bots, desktop/mobile capture, uploaded recordings, summaries, searchable conversations, speaker talk-time analytics, topic tracking, and integrations that send notes or tasks to CRM and project-management systems. It advertises dedicated cloud storage options; these are not device-local processing. [Official product page](https://fireflies.ai/). Indonesian appears in its documented API language list. [Language codes](https://docs.fireflies.ai/miscellaneous/language-codes).

**Why it stands out:** The value extends into existing work systems, reducing the manual step between a meeting and its follow-up work.

**Tradeoff and lesson:** Connected services and organizational setup are part of the workflow. Transkrip can learn from structured action items and reusable analysis outputs without automatically introducing external integrations that conflict with its local boundaries.

### 6. Notta — multilingual capture, including Indonesian–English

**Documented offer:** Web and mobile apps, desktop capture, file imports, meeting integrations, summaries, and cross-meeting questions. [Official product page](https://www.notta.ai/en). Its bilingual workflow explicitly allows selecting two supported languages, including Indonesian and English, for recordings and uploaded files. The bilingual-file help page lists a 1 GB/three-hour audio limit and a 10 GB/three-hour video limit. These are documented for that workflow, not universal limits for every plan or capture mode. [Bilingual help](https://support.notta.ai/hc/en-us/articles/23437010425755-Bilingual-transcription-translation-Web).

**Why it stands out:** Bilingual handling is an explicit user-facing workflow, not merely an entry in a long language list.

**Tradeoff and lesson:** Language options vary by feature. Indonesian support is not enough to differentiate Transkrip. A meaningful comparison needs mixed-language recordings, Indonesian names and acronyms, and measured correction effort. [Language coverage](https://support.notta.ai/hc/en-us/articles/4403155631131-What-languages-does-Notta-support).

### 7. Sonix — searchable, structured recording collections

**Documented offer:** Timestamped speaker transcripts, document and recording analysis in one workspace, multi-transcript questions, translation, and integrations. [Official product page](https://sonix.ai/). Its API documents Indonesian transcription, multilingual hints, keyword hints, callbacks, and transcript exports. [Official API documentation](https://sonix.ai/docs/api).

**Why it stands out:** It emphasizes finding and reusing information across a collection, rather than ending at a single transcript.

**Tradeoff and lesson:** Pricing distinguishes processing, AI workspace usage, storage, and seats; the pay-as-you-go offer lists **US$10 per hour**, without AI workspace usage. These are different cost dimensions from a flat local license. Transkrip's local search and selected-transcript analysis are relevant foundations, but should develop clear source references and more useful structured exports. [Pricing](https://sonix.ai/pricing).

### 8. Happy Scribe — AI speed with a human service option

**Documented offer:** AI transcription, meeting notes, subtitles, translation, mobile recording, and optional human-made services. Its workflow includes subtitle editing and downloadable or burned-in subtitles. [Official product page](https://www.happyscribe.com/). Professional transcription and translation have their own language coverage, which should not be assumed identical to the broader AI offer. [Human services](https://www.happyscribe.com/professional-transcription-services).

**Why it stands out:** Customers can choose between producing an editable draft and paying for additional professional review and delivery work.

**Tradeoff and lesson:** Human services introduce a different turnaround and cost model. Transkrip currently provides user review, not a professional review service. Improving its speaker corrections, subtitle usability, and final document output is more relevant than copying an advertised accuracy percentage.

### 9. Descript — the transcript becomes the media editor

**Documented offer:** Text-based audio/video editing, filler-word removal, audio enhancement, clip creation, and AI-assisted production. [Official product page](https://www.descript.com/).

**Why it stands out:** The customer outcome is a finished podcast, video, or reusable clip. Transcription is the editing interface rather than the final deliverable.

**Tradeoff and lesson:** This is an adjacent market with much broader production scope. Its pricing feature list names 25 transcription languages without Indonesian, while Indonesian appears in caption translation; those capabilities must not be conflated. Transkrip should prioritize accurate, reviewable text unless it deliberately chooses to become a media editor. [Language and feature distinctions](https://www.descript.com/pricing).

### 10. Rev — human-reviewed services and evidence workflows

**Documented offer:** Human transcription, captions, legal transcript services, transcript editing and clipping, and analysis across evidence files. Its current website prominently targets legal and investigative work. [Official product and services](https://www.rev.com/).

**Why it stands out:** It combines software with a service-delivery layer and a specific professional workflow. Buyers can seek more than an unreviewed automated draft.

**Tradeoff and lesson:** Service type, language, turnaround, and contract requirements need separate evaluation. This research does not establish Indonesian human-transcription availability or legal suitability. For Transkrip, the useful lesson is preserving source material and making corrections and analysis traceable—not claiming equivalent certification or review guarantees.

### 11. Prosa Salyns — Bahasa Indonesia-focused workflow

**Documented offer:** Indexed official material describes Indonesian-focused speech-to-text, audio/video upload and URL import, real-time recording, summaries, audio-linked editing, and sentence-separated TXT export. [Official Salyns page](https://salyns.prosa.ai/).

**Why it stands out:** Its product presentation directly addresses Indonesian researchers, journalists, educators, and meeting-note workflows. That overlaps closely with Transkrip's intended audience.

**Tradeoff and lesson:** The page failed direct access during this research. Current availability, pricing, deployment options, and limits remain unverified; do not interpret indexed marketing as proof of an operational service. Its documented positioning still shows why “built for Bahasa Indonesia” needs a sharper value proposition and comparative evidence.

## Competitive implications for Transkrip

### Existing strengths to demonstrate

These are repository-backed capabilities, not proof of superiority: browser-local recognition; local SQLite history and owner-scoped search; optional local speaker diarization; raw versus corrected text; Indonesian-oriented model selection; and explicit analysis of selected saved transcripts through local services. [Architecture and features](README.md), [product boundaries](PRODUCT.md).

The product owner's intended audience spans legal, media, education, public and private sectors, human resources, corporate secretariat, public communication, libraries, and archives. This direction comes from the owner's domain experience, not from market validation. See [cross-domain workflows](PRODUCT.md#cross-domain-workflows).

The resulting hypothesis is: **People across these domains may value a private workspace that turns recorded conversations into reviewable transcripts, working records, and structured findings.** Privacy-sensitive users are an important validation group, not the entire audience. Demand, priority workflows, and willingness to pay still need customer validation.

### Claims to avoid

| Potential claim | Why it is not established |
| --- | --- |
| “The only private transcription app” | MacWhisper and Buzz already offer local processing. See their profiles above. |
| “Unique Indonesian–English support” | Notta documents this bilingual pair; Indonesian-focused Salyns material also exists. |
| “More accurate than cloud products” | No shared evaluation recordings, reference transcripts, or comparative error measurements exist. |
| “Handles large files without limits” | Current input ceiling is 250 MB/four hours; decoding still requires the complete file in memory. |
| “Runs entirely in the browser” | Recognition runs there, but persistence and optional analysis use local services. |
| “Enterprise-ready because it is local” | Local accounts are not evidence of SSO, shared-workspace governance, support commitments, or certifications. |

Transkrip's last three qualifications follow its [documented implementation](README.md) and [decoder limitations](docs/audio-processing-performance.md). Competitor privacy labels should likewise be evaluated by actual processing location: encrypted cloud storage, recording without a bot, offline capture, and offline transcription describe different things.

### Recommended priorities

These are proposed product directions inferred from the comparison, not implemented work or a validated roadmap.

| Priority | Improvement | Competitive reason | Evidence of success to collect |
| --- | --- | --- | --- |
| 1 | Reliable long-recording jobs: clear preparation progress, recovery, cancellation, and a considered local conversion path | TurboScribe sets explicit expectations for size and batch handling; local alternatives offer automation | Import success rate by codec and size; peak memory; completion after interruption; time to first transcript |
| 2 | Indonesian–English evaluation and terminology handling | Notta already exposes bilingual selection; Salyns targets Indonesian users | Word errors, names/numbers/acronym errors, and human correction minutes on consented Indonesian and mixed-language recordings |
| 3 | Review and provenance: speaker fixes, visible edit history, analysis linked to source passages | Sonix and Rev emphasize finding and reusing evidence | Time to verify a quote or action item; speaker attribution errors; unsupported summary statements |
| 4 | Easier installation and readiness checks | MacWhisper and Buzz package local workflows for desktop users | Time from installation to first successful transcript; failed setup rate; support requests |
| 5 | Practical output formats and repeatable workflows | Competitors offer broader document/subtitle delivery and batch use | Successful use of outputs in customers' actual tools; repeat use across an interview series |

Increasing the file-size constant alone would not satisfy priority 1. The current decoder holds a complete input and decoded audio, and browser inference depends on the page remaining alive. A native/local processing option would require an explicit architecture decision about where recognition runs. [Audio implementation](src/audio.ts), [performance notes](docs/audio-processing-performance.md), [workspace recovery](README.md#preserving-work-through-idle-time-and-sleep).

## Commercial interpretation

Three observed price structures provide useful reference points: a one-time desktop license (MacWhisper), a flat subscription for bulk file use (TurboScribe), and metered processing plus workspace plans (Sonix). These buy different combinations of computation, storage, convenience, and collaboration; they are not interchangeable price-per-minute comparisons. [MacWhisper pricing](https://www.macwhisper.com/), [TurboScribe pricing](https://turboscribe.ai/), [Sonix pricing](https://sonix.ai/pricing).

For Transkrip, a paid local package or supported organizational deployment is worth testing as a hypothesis. The value would need to be dependable operation, setup/support, and reduced review effort. Local compute still costs hardware capacity, user time, and maintenance. This research provides no basis for selecting a price or forecasting revenue.

## Next validation work

1. Interview people across legal, media, education, public/private organizations, HR, corporate secretariat, and public communication, alongside librarians and archivists. Compare required outputs, review and approval practices, upload restrictions, recording volume, and setup tolerance.
2. Compare Transkrip against **MacWhisper or Buzz** for local use and **Notta or TurboScribe** for cloud-acceptable use. These are suggested evaluation groups, not overall winners.
3. Use the same consented recordings: clean Indonesian, English, mixed-language speech, names and numbers, noisy interviews, multiple speakers, and long video containers. Do not upload private customer recordings without permission.
4. Measure total time to an approved deliverable, not just inference speed. Record model/version, device, file codec/size, errors, correction effort, speaker quality, and analysis grounding.
5. Recheck Salyns availability and all relevant plan limits before procurement or public comparison. Treat unsupported or undocumented capabilities as unknown rather than absent.

Validate a shared recording-to-reviewed-record workflow across several domains, then prioritize the outputs users repeatedly need. A focused first workflow should make delivery manageable without restricting the long-term audience to one profession. The competitive research does not yet prove demand in any of these sectors.
