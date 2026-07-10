# Gemini 3.5 Flash — model card

> Source: https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash
> Saved: 2026-06-27 · Last updated upstream: 2026-06-24 UTC

Gemini 3.5 Flash provides sustained frontier-level intelligence optimized for
real-world tasks at higher speed and lower cost. Designed for the agentic era:
sub-agent deployment, multi-step workflows, long-horizon tasks. Effective for
rapid agentic loops. **This is the Cicero default model.**

## `gemini-3.5-flash`

| Property           | Value                                                          |
| ------------------ | -------------------------------------------------------------- |
| Model code         | `gemini-3.5-flash`                                             |
| **Inputs**         | **Text, Image, Video, Audio, PDF**                             |
| **Output**         | **Text only**                                                  |
| Input token limit  | 1,048,576                                                      |
| Output token limit | 65,536                                                         |
| Latest update      | May 2026                                                       |
| Knowledge cutoff   | **January 2025**                                               |
| Versions           | Stable: `gemini-3.5-flash` · Preview: `gemini-3-flash-preview` |

## Capabilities (what's supported)

| Capability                                      | Supported?                           | Relevance to Cicero                                                                                                             |
| ----------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Function calling                                | ✅                                   | The whole agent tool loop.                                                                                                      |
| Thinking                                        | ✅ (cannot be fully disabled on 3.x) | `reasoning_effort: minimal` already patched in repo.                                                                            |
| Structured outputs                              | ✅                                   | MacroTool / schema-constrained actions.                                                                                         |
| Image understanding (vision)                    | ✅ (input)                           | "See the screen" — the `capture_screenshot` tool + screenshot-on-error.                                                         |
| Audio understanding                             | ✅ (input)                           | "Understand voice" — Gemini STT path.                                                                                           |
| Code execution                                  | ✅                                   | (server-side; not used — we run JS in the page instead).                                                                        |
| Computer use                                    | ✅ (Preview)                         | Alternative future control path; not used now.                                                                                  |
| Search grounding / URL context / Maps grounding | ✅                                   | Optional future enhancements.                                                                                                   |
| Caching                                         | ✅                                   | Could cut cost on repeated context later.                                                                                       |
| **Live API**                                    | **❌ Not supported**                 | ⚠️ Realtime (audio-to-audio) needs a **different** model, e.g. `gemini-3.1-flash-live-preview`. Keep voice behind an interface. |
| **Audio generation (native TTS)**               | **❌ Not supported**                 | ⚠️ TTS-out must use the browser `speechSynthesis`, or a separate TTS model (`gemini-3.1-flash-tts-preview`) later.              |
| Image generation                                | ❌                                   | Not needed.                                                                                                                     |

## Consequences for the plan

1. **Vision works** via image _input_ (base64 screenshot). ✅
2. **Voice-in works** via audio _input_ (Gemini STT). ✅
3. **Voice-out (TTS)** is **not** a Gemini-3.5-flash feature → use Web Speech
   `speechSynthesis` now; swap to a TTS model later behind the `Speaker` interface.
4. **Realtime** (Live API) is **not** on this model → defer; wire later with a
   Live-capable model behind a `RealtimeSession` interface.
