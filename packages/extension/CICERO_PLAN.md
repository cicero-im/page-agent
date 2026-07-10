# Cicero Enfermeiro Digital — Implementation Plan

> A voice-driven browser assistant for a lawyer who broke **both hands** (she can
> still move with pain, so she **can click a big STOP button**). She is **afraid
> of computers**. She speaks or types; a Gemini-powered agent does the rest:
> sees the screen, drives the DOM, runs JavaScript, reads results back aloud.
>
> **Two non-negotiables drive every decision in this document:**
>
> 1. **It must never feel broken.** If it feels broken once, she stops using it.
>    Errors are caught, recovered from, and explained calmly in Portuguese —
>    never shown as a stack trace, never a dead end.
> 2. **The model is "dumb" (gemini-3.5-flash is small/cheap).** We compensate
>    with diligence: high-level pre-made tools, on-demand vision, automatic
>    screenshots on every error, and an explicit, recipe-rich Portuguese prompt.
>    We make the model's job as easy as we possibly can.
>
> Distribution: **sideloaded** (not the Chrome Web Store — no time to wait for
> review). Fork/extension of `@page-agent/ext`.

---

## 0. Scope

**Now (this plan implements all of it):**

- Gemini `gemini-3.5-flash` as the default model, user-supplied API key, editable
  system prompt.
- **Voice input (STT) and text input.** Pressing the mic and speaking **submits**
  a task — no typing required.
- **Text-to-speech (TTS)** so she _hears_ answers, status, and confirmations.
- **Vision as a tool the model calls when it wants** (`capture_screenshot`), plus
  **an automatic screenshot attached on every error** so the model can see what
  went wrong and recover.
- **A library of pre-made high-level tools** (many implemented in JavaScript) that
  the model may use to lower its error rate (click-by-text, fill-by-label, read
  page text, dismiss popups, …).
- **`execute_javascript` fully wired** (it is currently a half-connected switch).
- **Robust, forgiving UX** for a computer-fearful user: one big mic button, large
  text, spoken status, friendly Portuguese error messages, a always-visible STOP.
- **Portuguese (pt-BR) UI and prompt.**
- **Cicero Enfermeiro Digital branding** and a **layperson installation package**.

**Later (architected now, wired later — keep the seams ready):**

- **Realtime conversation** (Gemini Live audio-to-audio, barge-in). We build the
  voice layer behind interfaces (`Transcriber`, `Speaker`) so a `GeminiLive`
  implementation drops in without touching the agent. See §5.8.

---

## 1. Verified facts (read from the code and the official docs)

Everything below was checked against the actual files / live Google docs — not
assumed. Docs are saved under `packages/extension/gemini-docs/`.

| Claim                                                                                                                                                           | Status   | Evidence                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `gemini-3.5-flash` exists, **Stable**, multimodal (text+vision+audio)                                                                                           | ✅       | `gemini-docs/02-models.md` (Google Models page)                                                                               |
| OpenAI-compatible endpoint is `https://generativelanguage.googleapis.com/v1beta/openai/` and accepts `model`, `tools`/`tool_choice`, `image_url`, `input_audio` | ✅       | `gemini-docs/01-openai-compatibility.md`                                                                                      |
| Adjustable safety filters are **OFF by default** on Gemini 2.5/3                                                                                                | ✅       | `gemini-docs/03-safety-settings.md` ("default block threshold is Off for Gemini 2.5 and 3 models")                            |
| `safety_settings` over the OpenAI-compat layer is documented for **Images only**, not Chat                                                                      | ✅       | `gemini-docs/01-openai-compatibility.md` (`extra_body` table)                                                                 |
| The repo's LLM client is OpenAI-compatible and **JSON-stringifies `messages` as-is**                                                                            | ✅       | `packages/llms/src/OpenAIClient.ts:43,71`                                                                                     |
| A Gemini patch already exists (only sets `reasoning_effort:'minimal'`)                                                                                          | ✅       | `packages/llms/src/utils.ts:110-113`                                                                                          |
| `execute_javascript` tool exists in core and calls `pageController.executeJavascript(script, signal)`                                                           | ✅       | `packages/core/src/tools/index.ts:182-198`                                                                                    |
| Core **registers `execute_javascript` by default but deletes it** unless `experimentalScriptExecutionTool` is true                                              | ✅       | `packages/core/src/PageAgentCore.ts:144-145`                                                                                  |
| The content script **already routes** `execute_javascript` to the page (main world)                                                                             | ✅       | `RemotePageController.content.ts:84,129-130`; `wxt.config.js` exposes `main-world.js` as a web-accessible resource            |
| The agent-side controller **stubs** it (only missing piece)                                                                                                     | ✅       | `RemotePageController.ts:136` ("intentionally not implemented: AbortSignal cannot cross context")                             |
| The flag is currently `false`                                                                                                                                   | ✅       | `MultiPageAgent.ts:57`                                                                                                        |
| Config UI already has apiKey / baseURL / model / **systemInstruction**                                                                                          | ✅       | `ConfigPanel.tsx:30-35,107,303`                                                                                               |
| `systemInstruction` is already plumbed to `instructions.system`                                                                                                 | ✅       | `useAgent.ts:73-76`                                                                                                           |
| Custom tools merge into the agent by name                                                                                                                       | ✅       | `PageAgentCore.ts:137-140`; example `MultiPageAgent.ts:29` (`createTabTools`)                                                 |
| **There is NO screenshot / vision support anywhere** — the agent observes ONLY `simplifiedHTML`                                                                 | ✅ (gap) | `PageController.ts:77,129-218`; observe loop `PageAgentCore.ts:268`; `Message.content: string \| null` `llms/src/types.ts:11` |
| **A single thrown error ends the whole task** (the per-step catch `break`s)                                                                                     | ✅ (gap) | `PageAgentCore.ts:326-337`                                                                                                    |
| DOM-action _failures_ are already returned as strings (not thrown), so the model can recover from those                                                         | ✅       | `RemotePageController.ts:145-159` returns `{success:false, message}`; tools return `result.message`                           |

**Two facts the previous draft of this plan got wrong / hid — corrected here:**

- ❌ _"Inject `safety_settings` = OFF."_ Unnecessary **and** likely ineffective:
  Gemini 3 filters are already OFF by default, and the OpenAI-compat layer only
  honors `safety_settings` on the Images endpoint. **Decision: do not implement.**
- ❌ _"Vision is just wiring."_ It is **net-new**: there is zero screenshot/vision
  code. The previous plan's "navigation" section only covered DOM+JS+console and
  silently dropped the "see the screen" requirement. **This plan implements
  vision properly** (§5.4).

---

## 2. Resolved decisions

| #   | Decision           | Choice                                                                                                                                                                                                                                                                | Rationale                                                                                                                                                                         |
| --- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Voice route        | **Gemini-native STT primary** (record → send `input_audio` → transcript), **Web Speech API optional fast path**, both behind a `Transcriber` interface                                                                                                                | "Make Gemini understand voice." Gemini STT uses her key, handles accents, isn't subject to Chrome's flaky side-panel web-speech. Web Speech stays as a zero-latency option.       |
| B   | Localization depth | **Pragmatic pt-BR** (hardcoded pt-BR strings + Chrome manifest pt-BR catalog)                                                                                                                                                                                         | One user, one gift. Wiring the full i18n system is over-engineering here.                                                                                                         |
| C   | System prompt      | Assistive Portuguese persona, explicit task **recipes**, tool-use guidance, the requested uppercase obey directive — **with a hard limit: confirm out loud before payments, legal/financial actions, sends (email/message on her behalf), deletes, and public posts** | She can click STOP; spoken confirmation + her hand on STOP protects her from a dumb model doing something unrecoverable.                                                          |
| D   | Delivery           | **ZIP**, unzipped into a fixed folder, `INSTALACAO.md` + `LEIA-ME.txt` inside                                                                                                                                                                                         | Cleanest; predictable folder path; survives the "don't move the folder" rule.                                                                                                     |
| E   | Default config     | **Add a separate `DEFAULT_CONFIG`** — do **not** repurpose `DEMO_*`                                                                                                                                                                                                   | Repurposing `DEMO_BASE_URL` would make `isTestingEndpoint()` (`ConfigPanel.tsx:205`, `useAgent.ts:57-64`) flag the _real_ Gemini endpoint as a test endpoint. Keep them separate. |
| F   | Safety filters     | **Do not inject**                                                                                                                                                                                                                                                     | §1 — already OFF; compat layer ignores it on chat.                                                                                                                                |
| G   | Realtime           | **Architect now, build later**                                                                                                                                                                                                                                        | §5.8 — interfaces + stubs only.                                                                                                                                                   |
| H   | API key            | **She pastes it once** — `DEFAULT_GEMINI_API_KEY` stays empty; first-run shows one friendly field; key saved to extension storage                                                                                                                                     | No secret embedded in the build, so the build stays shareable; trivially changeable later.                                                                                        |
| I   | Icon               | **Arthur provides the final icon** — wire the icon slot, keep the existing placeholder asset until it arrives                                                                                                                                                         | Branding completes when the asset lands; does not block any phase.                                                                                                                |

---

## 3. Architecture changes (by area)

Each subsection states **what / why / files (verified) / approach**. Phases and
ordering are in §5; the file-by-file table is in §4.

### 3.1 Gemini as the default

- **Files:** `src/agent/constants.ts`, `src/agent/useAgent.ts:53,62-63`,
  `src/components/ConfigPanel.tsx:30-31,55-56`.
- **Approach:** add `DEFAULT_CONFIG = { model: 'gemini-3.5-flash', baseURL:
'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: '' }` and a
  `DEFAULT_SYSTEM_INSTRUCTION` (§5.9). `useAgent` falls back to `DEFAULT_CONFIG`
  (not `DEMO_CONFIG`); `ConfigPanel` defaults to the Gemini values. `DEMO_*` and
  `isTestingEndpoint` stay untouched (Decision E). The existing Gemini
  `reasoning_effort:'minimal'` patch (`llms/src/utils.ts:110`) already applies.
- **Settings menu — already exists, no new build.** `ConfigPanel.tsx` already
  exposes exactly the four fields requested: **endpoint** (`baseURL`), **model
  name**, **API key**, and **system prompt** (`systemInstruction`)
  (`ConfigPanel.tsx:30-35,107,303`). We only: (1) **preset the Google/Gemini
  values** as defaults (so she — or you — usually touch nothing but the key),
  (2) keep all four **editable**, (3) translate the labels to pt-BR. No field is
  removed; the Google preset is the starting point, not a lock.

### 3.2 `execute_javascript` — finish the half-wired switch

- **Files:** `RemotePageController.ts:136` (the stub), `MultiPageAgent.ts:57`
  (the flag). Content-script side already done (`...content.ts:84,129`).
- **Approach:** implement agent-side `executeJavascript(script, signal)` that
  forwards via the existing `remoteCallDomAction('execute_javascript', [script])`
  message bridge. The `AbortSignal` cannot cross the messaging boundary
  (structured clone) — so we **strip it before sending** and accept that
  **cancellation is best-effort** for in-page JS (documented). Set
  `experimentalScriptExecutionTool: true`. This single change also unlocks all
  the JS-based pre-made tools in §3.3.
- **✅ Status: DONE + dogfooded (Phase 1).** The bridge is implemented and was
  verified end-to-end in a real loaded extension: a `PAGE_CONTROL`/`execute_javascript`
  message routes agent context → background relay → content script → page and
  returns a structured `DomActionReturn`.
- **⚠️ Known limitation (found in dogfood):** the script runs as a **string in the
  MAIN world**, so `unsafe-eval` CSP blocks it on strict sites (e.g. `example.com`).
  `execute_javascript` should stay an **advanced/escape-hatch** tool; the everyday
  toolbelt (§3.3) must use **isolated-world** DOM ops instead. Optionally add a
  CSP-proof variant via `chrome.scripting.executeScript` (ISOLATED world).

### 3.3 Pre-made high-level tools ("make the dumb model's life easy")

- **Why:** a small model is bad at picking the right element index and at writing
  correct ad-hoc JavaScript. We give it robust, intention-level tools so it
  rarely has to. This is the single biggest reliability lever.
- **Files:** new `src/agent/helperTools.ts`, registered as `customTools`
  alongside `createTabTools` in `MultiPageAgent.ts:29`. Each tool returns a clear,
  short string.
- **⚠️ Implementation rule (verified by Phase-1 dogfood — do NOT use eval).** The
  existing `execute_javascript` runs the script as a **string in the page's MAIN
  world**, which is blocked by `unsafe-eval` Content-Security-Policy on real sites
  (confirmed live: `example.com` returned _"Evaluating a string as JavaScript
  violates the following Content Security Policy directive because 'unsafe-eval'
  is not an allowed source"_). Therefore the helper tools must **NOT** be
  `execute_javascript` string-eval wrappers. Implement them as **isolated-world
  DOM operations** — either existing `PageController` DOM actions, new
  `PageController` methods, or `chrome.scripting.executeScript({ target, func })`
  running in the **ISOLATED** world (extension-privileged, **CSP-exempt**, no
  string eval). Isolated-world code can touch the DOM (all these tools need) but
  not page JS globals — fine here. This keeps the toolbelt working on
  CSP-strict sites (Gmail, bank/court portals — exactly her use cases).
- **Tool set (curated for a non-technical user's real tasks):**
    | Tool                                      | What it does (robustly, so the model doesn't have to)                                                                                                                   |
    | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `click_text(text)`                        | Find the best visible element matching `text` (button/link/role), scroll to it, click. Fuzzy, case-insensitive. Beats index-guessing.                                   |
    | `fill_field(label, value)`                | Find an input by its `<label>`, `aria-label`, `placeholder`, or nearby text; focus, clear, type, fire events.                                                           |
    | `read_page_text()`                        | Return the main readable text of the page (for the model to reason over **and** for TTS to read to her). Answers "only simplified HTML?" — now there's clean prose too. |
    | `find_text(query)`                        | Report whether text exists and scroll it into view.                                                                                                                     |
    | `dismiss_overlays()`                      | Close cookie banners / modal popups / "accept" dialogs (a top cause of stuck agents).                                                                                   |
    | `list_actions()`                          | Enumerate visible links/buttons with their text — a navigation map for the model.                                                                                       |
    | `wait_for_text(text, seconds)`            | Poll until text appears (page/AJAX load), honoring `signal`.                                                                                                            |
    | `go_back()` / `go_forward()` / `reload()` | Safe history nav.                                                                                                                                                       |
    | `page_info()`                             | Title + URL + a one-line summary.                                                                                                                                       |
- Each tool: (1) honors `signal`; (2) **never throws** — on failure returns a
  descriptive string ("Não encontrei um botão com esse texto…") so the loop
  continues (ties into §3.5); (3) has a Portuguese-friendly `description` aimed at
  the model.

### 3.4 Vision — a screenshot tool the model can call

- **Why:** "the model has vision, so it must see the screen if it wants." Net-new.
- **Files:**
    - `packages/llms/src/types.ts:11` — widen `Message.content` to
      `string | ContentPart[] | null`, where `ContentPart` is
      `{type:'text',text} | {type:'image_url',image_url:{url}}` (OpenAI/Gemini
      shape). `OpenAIClient` already forwards it verbatim (`:43,71`) — verified, no
      client change needed beyond the type.
        > ⚠️ **API shape note.** This is the **Chat Completions** image form
        > (`image_url: { url: "data:..." }`), which is what Gemini's OpenAI-compat
        > `chat/completions` endpoint expects (`gemini-docs/01-openai-compatibility.md`).
        > It is **not** the **Responses API** form (`type:"input_image"`,
        > `image_url:"data:..."` as a bare string). Our client uses Chat Completions,
        > so we use the chat form. Do not switch to `input_image`.
    - `packages/page-controller/src/PageController.ts` (+ extension
      `RemotePageController.ts` / `...background.ts`) — add
      `captureScreenshot(): Promise<string /* dataURL */>` using
      `chrome.tabs.captureVisibleTab` (extension already has `tabs` + `<all_urls>`,
      `wxt.config.js:48-49`).
    - `packages/core/src/PageAgentCore.ts` — a private `#pendingImages: string[]`;
      the observe-step message assembly (`:273-276`) emits an **array** content
      (`[{type:'text',text:prompt}, ...images]`) when images are pending, else a
      plain string (fully backward-compatible). `capture_screenshot` tool pushes the
      dataURL into `#pendingImages` and returns `"Screenshot captured."`.
    - `packages/core/src/tools/index.ts` — new `capture_screenshot` tool, gated by a
      new `experimentalVisionTool` flag (mirrors the JS-tool gating at `:144`).
- **Approach:** on-demand by default (cheap for a small model). The auto-on-error
  screenshot (§3.5) reuses the exact same `#pendingImages` channel.

### 3.5 Robustness — screenshot on every error + never kill the task

This is the heart of "it must never feel broken."

- **Why:** today, one thrown error `break`s the whole run (`PageAgentCore.ts:326-337`)
  → task fails → she thinks it's broken. DOM-action failures are already soft
  (returned as strings), but JS exceptions, vision/transcription hiccups, and
  transient LLM errors are hard-fails.
- **Approach (two layers):**
    1. **Per-action resilience.** Wrap individual tool execution so a thrown tool
       error becomes: capture screenshot → push an observation ("A ação X falhou:
       <motivo>. Veja a tela.") → **continue the loop** so the model can try
       another way. Keep a **consecutive-error budget** (e.g. 3 in a row → stop
       gracefully and speak a calm message) to avoid infinite flailing. This
       preserves AGENTS.md's "errors must be visible and actionable" while not
       nuking the UX.
    2. **Always-screenshot-on-error.** Anywhere an error is surfaced (soft failure
       string _or_ caught throw), attach a screenshot to `#pendingImages` so the
       next LLM turn _sees_ the failure. (User's explicit requirement: "in errors,
       always send a screenshot.")
- **Files:** `PageAgentCore.ts` (tool-exec wrapper around the MacroTool dispatch;
  the per-step `catch` at `:326`), reusing `captureScreenshot()` (§3.4) and
  `pushObservation()` (`:192`).
- **Traceability:** raw errors still go to history/`activity` (`:332-333`) for the
  panel and logs — we hide them from _her_, not from the developer.

### 3.6 Voice input (STT) — behind a `Transcriber` interface

- **Files:** new `src/lib/voice/` (`Transcriber.ts` interface,
  `GeminiAudioTranscriber.ts`, `WebSpeechTranscriber.ts`, `index.ts`); wired into
  the sidepanel (`entrypoints/sidepanel/App.tsx`).
- **Interface:** `start(): void`, `stop(): Promise<string>` (final transcript),
  `onPartial?(cb)`, `onError(cb)`, `dispose()`.
- **`GeminiAudioTranscriber` (primary):** `getUserMedia` → **WebAudio → WAV (PCM,
  16 kHz mono)** via a small in-house encoder → base64 → POST to the configured
  Gemini OpenAI-compat `chat/completions` with an `input_audio` part
  (`format: "wav"`) and a "transcribe to pt-BR, output only the transcript"
  instruction. Uses her key/baseURL.
    > ⚠️ **Do NOT use `MediaRecorder` here.** Chrome's `MediaRecorder` produces
    > **`audio/webm`**, which Gemini's audio input does **not** accept (supported:
    > WAV/MP3/AIFF/AAC/OGG/FLAC — `gemini-docs/07-audio-understanding.md`). Using
    > WebM = voice silently fails. We encode WAV ourselves to guarantee a supported
    > format on both the OpenAI-compat (`format:"wav"`) and native paths. (Gemini
    > downsamples audio to 16 kbps anyway, so 16 kHz mono is plenty; ~32 tokens/s.)
- **`WebSpeechTranscriber` (optional):** `webkitSpeechRecognition`, `lang:'pt-BR'`.
- **Submit-by-voice:** mic press → record → transcript → fill the input box →
  **auto-submit** `agent.execute(transcript)`. Empty/failed transcript → gentle
  spoken "Não entendi, pode repetir?" (no error surface).
- **Mic permission:** the side panel is an extension page; `getUserMedia` needs a
  one-time grant. We add a first-run permission step with a friendly prompt, and
  if denied, fall back to text input with a spoken explanation. (Mic permission is
  requested at runtime — there is no manifest `microphone` permission to add.)

### 3.7 TTS output — behind a `Speaker` interface

- **Files:** `src/lib/voice/Speaker.ts` (interface), `WebSpeechSpeaker.ts`
  (`window.speechSynthesis`, `lang:'pt-BR'`), `index.ts`.
- **Speaks:** the agent's final answer, key confirmations (§5.9), and status
  transitions ("Estou ouvindo", "Estou trabalhando", "Pronto", "Tive um
  probleminha, vou tentar de novo"). All cancelable when she presses STOP or the
  mic again (barge-in friendly — sets up §5.8).

### 3.8 Realtime-ready seams (deferred, not built)

- Add `GeminiLiveTranscriber.ts` and `GeminiLiveSpeaker.ts` as **stubs** that
  implement the same `Transcriber`/`Speaker` interfaces and throw
  `NotImplementedError`. Document the swap point (a single factory in
  `voice/index.ts`). When Gemini Live (`gemini-3.1-flash-live-preview`,
  `gemini-docs/02-models.md`) is wired, only the factory changes — agent, UI, and
  prompt are untouched.

### 3.9 System prompt for a small model + a scared user

- **File:** `DEFAULT_SYSTEM_INSTRUCTION` in `constants.ts`, fed via
  `instructions.system` (`useAgent.ts:73-76`). The base `system_prompt.md` and its
  language replacement (`MultiPageAgent.ts:32-37`) stay.
- **Contents:** (1) persona — a patient, dedicated assistant nurse who speaks
  pt-BR; (2) **concrete recipes** for her likely tasks (open Gmail and read new
  messages aloud; reply to an email; search and read a court/portal page; fill a
  simple form) — recipes are how you make a dumb model reliable; (3) **tool
  guidance** — "prefer `click_text`/`fill_field` over raw indices; call
  `read_page_text` to read content to the user; call `capture_screenshot` if
  unsure what's on screen; you will be shown a screenshot automatically when
  something fails"; (4) the requested uppercase obey directive; (5) **the hard
  limit:** before any irreversible/financial/destructive action (send, pay,
  delete, submit money), **state what you're about to do and ask for confirmation
  out loud** — this is protection, not refusal.

### 3.10 UX for a computer-fearful user

- **File:** `entrypoints/sidepanel/App.tsx` (+ small CSS).
- **Approach:** one **big** circular mic button (press-to-talk / tap-to-toggle);
  large, high-contrast text; a clear text input as the alternative; an
  **always-visible large STOP** button (she can reach it); a single status line
  that is **also spoken**. No jargon, no raw errors, ever. First-run shows only:
  paste API key (one field) → done.
- **Refresh / new conversation.** A clear "Nova conversa" control that resets the
  agent history and re-observes the current page (fresh context), so a stuck or
  confused session is never a dead end — she (or you) can always start clean
  without reinstalling. Maps to `execute()` resetting `history`/`#observations`
  (`PageAgentCore.ts:219-221`).

### 3.11 pt-BR localization (pragmatic) & 3.12 Branding

- **Localization:** new `public/_locales/pt_BR/messages.json`; set the manifest's
  default locale handling so the store card / action title render pt-BR; translate
  the hardcoded UI strings in `ConfigPanel.tsx` and `sidepanel/App.tsx` directly.
- **Branding:** `wxt.config.js:42-68` name/`homepage_url`/`artifactTemplate` →
  `cicero-enfermeiro-digital-{{version}}-{{browser}}.zip`; `_locales/*/messages.json`
  name/description/action title; icons (`assets/page-agent-*.png/webp`). **Need
  an icon from you, or I generate a placeholder.**

---

## 4. Impact surface (file-by-file)

| Area                         | File(s)                                                                                         | Change                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default Gemini               | `src/agent/constants.ts`                                                                        | Add `DEFAULT_CONFIG` + `DEFAULT_SYSTEM_INSTRUCTION` (keep `DEMO_*`)                                                                                           |
| Default wiring               | `src/agent/useAgent.ts:53,62-63`                                                                | Fall back to `DEFAULT_CONFIG`                                                                                                                                 |
| Config UI                    | `src/components/ConfigPanel.tsx:30-31,55-56`                                                    | Default to Gemini; pt-BR labels                                                                                                                               |
| JS exec                      | `src/agent/RemotePageController.ts:136`                                                         | Implement `executeJavascript()` (strip signal)                                                                                                                |
| JS exec flag                 | `src/agent/MultiPageAgent.ts:57`                                                                | `experimentalScriptExecutionTool: true`                                                                                                                       |
| Pre-made tools               | **new** `src/agent/helperTools.ts`; `MultiPageAgent.ts:29`                                      | Curated JS tools as `customTools`                                                                                                                             |
| Vision type                  | `packages/llms/src/types.ts:11`                                                                 | Widen `Message.content` to allow `ContentPart[]`                                                                                                              |
| Vision capture               | `packages/page-controller/src/PageController.ts`; ext `RemotePageController.{ts,background.ts}` | `captureScreenshot()` via `captureVisibleTab`                                                                                                                 |
| Vision tool + on-error shots | `packages/core/src/PageAgentCore.ts:144,273-276,326-337`; `packages/core/src/tools/index.ts`    | `capture_screenshot` tool + `#pendingImages` + per-action resilience + screenshot-on-error; new `experimentalVisionTool` flag in `packages/core/src/types.ts` |
| Voice STT                    | **new** `src/lib/voice/{Transcriber,GeminiAudioTranscriber,WebSpeechTranscriber,index}.ts`      | STT behind interface                                                                                                                                          |
| TTS                          | **new** `src/lib/voice/{Speaker,WebSpeechSpeaker}.ts`                                           | TTS behind interface                                                                                                                                          |
| Realtime stubs               | **new** `src/lib/voice/{GeminiLiveTranscriber,GeminiLiveSpeaker}.ts`                            | Interface stubs (deferred)                                                                                                                                    |
| Sidepanel UX                 | `src/entrypoints/sidepanel/App.tsx` (+ css)                                                     | Big mic, big STOP, spoken status, friendly errors, submit-by-voice                                                                                            |
| Prompt                       | `src/agent/constants.ts`                                                                        | `DEFAULT_SYSTEM_INSTRUCTION` (pt-BR, recipes, confirm-before-irreversible)                                                                                    |
| i18n                         | **new** `public/_locales/pt_BR/messages.json`; UI strings                                       | pt-BR                                                                                                                                                         |
| Branding                     | `wxt.config.js:42-68`; `_locales/*`; icons                                                      | "Cicero Enfermeiro Digital" + zip name                                                                                                                        |
| Install                      | **new** `INSTALACAO.md`, **new** `LEIA-ME.txt`                                                  | §9 (Portuguese)                                                                                                                                               |

---

## 5. Implementation phases (red-green TDD, smallest shippable steps)

Ordered so something usable exists early and risk is front-loaded. Each phase:
**write the test/criterion first → implement → verify → only then move on.** No
phase starts before the previous one is green. (This is the `/conejo-code` loop.)

- **Phase 1 — Gemini default + JS execution.** Decision E config; implement
  `executeJavascript` + flag on. _Green when:_ a smoke task drives a real page and
  a trivial `execute_javascript` returns a value. (Unit: config fallback;
  manual/E2E: live page.)
- **Phase 2 — Vision + robustness (the reliability core).** Widen `Message.content`;
  `captureScreenshot()`; `capture_screenshot` tool; `#pendingImages`; per-action
  resilience + screenshot-on-error. _Green when:_ (a) a forced tool error does
  **not** end the task and the next LLM message contains an image; (b) the model
  can call `capture_screenshot` and reason over it. (Unit: content-array assembly,
  error-doesn't-break, image attached on error; E2E: induce a failure, see
  recovery.)
- **Phase 3 — Pre-made tools.** `helperTools.ts`. _Green when:_ `click_text` /
  `fill_field` / `read_page_text` work on a real page and never throw. (Unit per
  tool against a jsdom fixture where feasible; E2E on a live form.)
- **Phase 4 — Voice in/out + submit-by-voice.** `Transcriber`/`Speaker` + sidepanel
  wiring. _Green when:_ pressing mic, speaking pt-BR, and releasing **submits** a
  task and the answer is **spoken**. (E2E with a seeded audio clip / manual mic.)
- **Phase 5 — Prompt + computer-fearful UX.** `DEFAULT_SYSTEM_INSTRUCTION`; big
  mic/STOP, spoken status, friendly errors. _Green when:_ a non-technical
  walkthrough (open mail, read aloud, reply with confirmation) succeeds and STOP
  works mid-task.
- **Phase 6 — pt-BR + branding + install package.** Locale, names, icons, zip,
  `INSTALACAO.md`, `LEIA-ME.txt`. _Green when:_ `npm run build:ext` produces
  `cicero-enfermeiro-digital-<v>-chrome.zip`, loads unpacked, card reads "Cicero
  Enfermeiro" in pt-BR.
- **Realtime:** interfaces/stubs land in Phase 4; **not** wired (Decision G).

After every phase: `npm run ci` (lint + format + typecheck + test + build) must be
green before continuing.

---

## 6. Testing & verification (St. Thomas — verify with your own eyes)

- **Unit (Vitest):** config fallback; `Message.content` array assembly;
  error-does-not-break-task; screenshot-attached-on-error; each helper tool's
  failure path returns a string (never throws). `@page-agent/llms` already has
  the Vitest setup to mirror.
- **E2E / dogfood:** use the `dogfood` / `desktop-test-agent` skills to load the
  unpacked extension in a **different browser/profile** and run the real
  voice→action→TTS round trip, plus a deliberately induced failure to confirm
  recovery (no dead end, screenshot taken, calm spoken message). Capture a GIF of
  the happy path for her.
- **Acceptance (the only test that really matters):** a non-technical person can,
  by voice alone, open email and have a message read aloud, and STOP works
  instantly. If any step _feels_ broken, it is not done.

---

## 7. Risks & mitigations

- **Gemini OpenAI-compat quirks** (`tool_choice:'required'`, `parallel_tool_calls`,
  `temperature`): existing escape hatch `disableNamedToolChoice`
  (`useAgent.ts:25,129`). Confirm with a live smoke test in Phase 1.
- **Mic in the side panel** is the biggest UX risk: Web Speech can be flaky there.
  Mitigation: Gemini-audio STT is primary; explicit permission UX; text fallback.
- **Audio encoding format:** Gemini rejects WebM (Chrome's `MediaRecorder`
  default). Mitigation: encode WAV (PCM 16 kHz mono) ourselves; never ship the
  `MediaRecorder`/WebM path (`gemini-docs/07-audio-understanding.md`). §3.6.
- **Free-tier `429`** mid-task reads as "broken" to her. Mitigation: treat 429 as
  retryable with backoff (`withRetry`), speak a calm "sobrecarregado" message,
  keep requests lean, and recommend linking billing (Tier 1) on her key
  (`gemini-docs/08-rate-limits.md`).
- **Vision token cost** on a cheap model: on-demand + on-error only, not every
  step.
- **Cross-context JS cancellation** is best-effort (documented).
- **`Message.content` change touches shared `@page-agent/llms`/core**: keep it
  strictly additive (string still valid) so library consumers don't break; run
  full `npm run ci`.
- **Sideload friction:** Chrome periodically asks to re-enable sideloaded
  extensions → covered in `INSTALACAO.md` ("clique **Manter / Keep**").
- **Icon asset** needed for full branding (or placeholder).

---

## 8. What does NOT change

The Re-Act loop shape, DOM pipeline, tabs/multi-page control, data-mask, history,
hub, the main-world bridge, MCP — all intact. This work is **additive**.

---

## 9. Instalação para leigos (pt-BR) — não vai estar na Chrome Web Store

> Esta seção é em **português**, escrita para quem tem medo de computador. Vai
> dentro do pacote como `INSTALACAO.md`, com um `LEIA-ME.txt` apontando para ela.

### Como o Cicero chega no computador dela

Você (quem está configurando) faz o build e entrega **um arquivo ZIP**:
`cicero-enfermeiro-digital-1.x.x-chrome.zip`. Copie para o computador dela e descompacte
numa pasta fixa, por exemplo `C:\CiceroEnfermeiro\` (Windows) ou
`~/CiceroEnfermeiro/` (Mac). **Depois de descompactar, não mova nem apague essa
pasta** — se mover, a extensão para de funcionar.

### Passo a passo (uma única vez, feito por você)

```
COMO INSTALAR O CICERO ENFERMEIRO DIGITAL (passo a passo)
==================================================

1.  Abra o Google Chrome.
2.  Na barra de endereços (onde você digita www...), escreva:
        chrome://extensions
    e aperte Enter.
3.  No canto superior direito, ligue a chavinha "Modo do desenvolvedor".
4.  Clique no botão "Carregar sem compactação" (canto superior esquerdo).
5.  Escolha a pasta que você descompactou (a pasta que tem dentro a "cicero-agent"),
    ou a própria "cicero-agent".
6.  Pronto! Vai aparecer o cartão "Cicero Enfermeiro Digital".

COMO DEIXAR FÁCIL DE USAR
-------------------------
7.  Clique no ícone de peça de quebra-cabeça (canto superior direito do Chrome).
8.  Ache "Cicero Enfermeiro Digital" e clique no alfinete (📌) para fixar.
9.  Clique no ícone do Cicero para abrir o painel do lado.
10. Na primeira vez, cole a CHAVE DA API (Gemini) no único campo pedido e salve.
11. Agora é só apertar o botão grande do microfone e falar. Para parar a qualquer
    momento, aperte o botão grande PARAR.

SE O CHROME RECLAMAR DEPOIS DE UMA ATUALIZAÇÃO
----------------------------------------------
- Às vezes o Chrome mostra um aviso sobre extensões instaladas "por fora".
  É só clicar em "Manter" (ou "Keep"). Não desinstale.

OUTROS NAVEGADORES (Edge, Brave)
--------------------------------
- Mesmos passos, mudando só o endereço: edge://extensions ou brave://extensions.
```

### Arquivos que a instalação adiciona

| Arquivo                                     | Conteúdo                                                |
| ------------------------------------------- | ------------------------------------------------------- |
| `wxt.config.js` `artifactTemplate`          | `cicero-enfermeiro-digital-{{version}}-{{browser}}.zip` |
| **novo** `packages/extension/INSTALACAO.md` | O passo a passo acima                                   |
| **novo** `packages/extension/LEIA-ME.txt`   | Uma linha: "Leia o INSTALACAO.md para instalar."        |

### Ressalvas (para o presente funcionar de verdade)

- **Não mover nem apagar a pasta** depois de instalada (senão dá "Manifest file
  not found").
- **Sem atualização automática** — extensão fora da loja não se atualiza sozinha;
  se houver versão nova, você instala manualmente.
- **A chave da API fica salva** — ela não precisa digitar de novo.

---

## 10. Effort

Medium–large. Front-loaded risk (vision + robustness in Phase 2) is the real
work; the rest is bounded because most plumbing already exists. ~14–18 edited
files + ~8 new files (voice layer, helper tools, locale, install docs) + one icon.
Realtime is interfaces only.

---

## Next step

Proceed phase by phase under `/conejo-code` (red-green TDD), `npm run ci` green
between phases, and dogfood-verify in a separate browser before declaring done.
**Open item:** the icon — send one, or I generate a placeholder.
