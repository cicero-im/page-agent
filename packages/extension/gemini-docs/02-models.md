# Models — Gemini API

> Source: https://ai.google.dev/gemini-api/docs/models
> Saved: 2026-06-27 · Last updated upstream: 2026-06-15 UTC
> Licensed under CC BY 4.0.

## Gemini 3 family (relevant entries)

| Model                     | id                                  | Status     | Note                                                                                                       |
| ------------------------- | ----------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| Gemini 3.1 Pro            | `gemini-3.1-pro-preview`            | Preview    | Advanced intelligence, agentic + coding.                                                                   |
| **Gemini 3.5 Flash**      | **`gemini-3.5-flash`**              | **Stable** | "Most intelligent model for sustained frontier performance on agentic and coding tasks." ← Cicero default. |
| Gemini 3 Flash            | `gemini-3-flash-preview`            | Preview    | Frontier-class at a fraction of cost.                                                                      |
| Gemini 3.1 Flash-Lite     | `gemini-3.1-flash-lite`             | Stable     | Cheapest, fastest.                                                                                         |
| Gemini 3.5 Live Translate | `gemini-3.5-live-translate-preview` | Preview    | Real-time speech-to-speech, 70+ languages.                                                                 |
| Gemini 3.1 Flash Live     | `gemini-3.1-flash-live-preview`     | Preview    | Low-latency Live API, voice-first. ← future realtime path.                                                 |
| Gemini 3.1 Flash TTS      | `gemini-3.1-flash-tts-preview`      | Preview    | Low-latency speech generation. ← future TTS upgrade.                                                       |

> `gemini-3.5-flash` is **Stable** and natively multimodal (text + vision +
> audio understanding). It is the right default for Cicero: vision for "see the
> screen", audio understanding for "understand voice", function calling for the
> agent tools.

## Tool & agent models (for reference / future)

- **Computer Use Preview** (`gemini-2.5-computer-use-preview-10-2025`) — a model
  that "sees" a screen and performs UI actions (click/type/navigate). Relevant
  if we ever want native computer-use instead of the DOM pipeline.
- Antigravity Agent, Deep Research — managed agentic models.

## Realtime / voice (for the "wire later" path)

- **Live API** models (`gemini-3.1-flash-live-preview`, `gemini-2.5-flash-native-audio-…`)
  provide bidirectional audio-to-audio. This is the target for a future
  "realtime conversation" mode — keep the Cicero voice layer behind an interface
  so a Live implementation can drop in.

## Model version name patterns

- **Stable** — e.g. `gemini-3.5-flash`. Doesn't change; use for production.
- **Preview** — e.g. `gemini-2.5-flash-preview-09-2025`. Production-allowed,
  deprecated with ≥2 weeks notice.
- **Latest** — e.g. `gemini-flash-latest`. Hot-swapped alias; 2-week email notice.
- **Experimental** — not for production.

## Thinking (Gemini 3 Flash)

Per the OpenAI-compat mapping, `reasoning_effort: "minimal"` → `thinking_level:
"minimal"` for Gemini 3 Flash. Reasoning **cannot be fully turned off** for
Gemini 3 models (only 2.5 supports `"none"`). The repo's existing Gemini patch
(`packages/llms/src/utils.ts`) already sets `reasoning_effort: 'minimal'`.
