# Gemini API documentation — local snapshot for the Cicero project

Saved 2026-06-27 from https://ai.google.dev/gemini-api/docs (CC BY 4.0; code
samples Apache 2.0). Captured so the Cicero implementation can be built against
exact, verified facts instead of memory. These back the claims in
`../CICERO_PLAN.md`.

| File                         | Page                  | Why it matters to Cicero                                                                                                                                                                             |
| ---------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-openai-compatibility.md` | OpenAI compatibility  | The endpoint `@page-agent/llms` already speaks. Confirms `image_url` (vision) + `input_audio` (STT) + function calling on `…/v1beta/openai/`. Notes `safety_settings` is **Images-only** via compat. |
| `02-models.md`               | Models                | The Gemini 3 lineup; which models are Live/TTS capable (for the deferred realtime path).                                                                                                             |
| `03-safety-settings.md`      | Safety settings       | **Adjustable filters are OFF by default on Gemini 2.5/3** → the old plan's "force safety OFF" work is unnecessary.                                                                                   |
| `04-function-calling.md`     | Function calling      | Tool/function-calling reference (the agent action loop).                                                                                                                                             |
| `05-gemini-3.5-flash.md`     | Gemini 3.5 Flash card | Default model. Inputs incl. Image+Audio; **no Live API, no native TTS**; knowledge cutoff Jan 2025.                                                                                                  |
| `06-image-understanding.md`  | Image understanding   | Screenshot → vision: formats, token cost (~258/tile), text-before-image rule.                                                                                                                        |
| `07-audio-understanding.md`  | Audio understanding   | Gemini STT: **record as WAV, not WebM**; token cost (32/s).                                                                                                                                          |
| `08-rate-limits.md`          | Rate limits           | Free-tier 429 risk → graceful handling so it "never feels broken".                                                                                                                                   |

> Endpoint base for everything: `https://generativelanguage.googleapis.com/v1beta/openai/`
> Default model: `gemini-3.5-flash`.
