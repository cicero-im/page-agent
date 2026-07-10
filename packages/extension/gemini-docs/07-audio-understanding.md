# Audio understanding (Gemini STT) — Gemini API

> Source: https://ai.google.dev/gemini-api/docs/audio
> Saved: 2026-06-27 · Last updated upstream: 2026-06-22 UTC

Gemini analyzes audio input → text. Supports transcription/translation, speaker
diarization, emotion, timestamps. **Used by Cicero as the "understand voice"
(STT) path** — record the friend's speech, send it to Gemini, get pt-BR text,
feed to the agent.

> For **real-time** transcription Google points to the Live API or Cloud
> Speech-to-Text. gemini-3.5-flash is **not** Live-capable (see
> `05-gemini-3.5-flash.md`), so Cicero does batch (record → send) STT now and
> defers realtime.

## How Cicero sends audio (OpenAI-compat)

Via the OpenAI-compat chat endpoint with an `input_audio` part (see
`01-openai-compatibility.md`):

```javascript
content: [
    {
        type: 'text',
        text: 'Transcreva este áudio em português do Brasil. Responda só com o texto.',
    },
    { type: 'input_audio', input_audio: { data: base64Audio, format: 'wav' } },
]
```

## Supported audio formats

WAV `audio/wav` · MP3 `audio/mp3` · AIFF · AAC · OGG Vorbis `audio/ogg` · FLAC.

> ⚠️ **CRITICAL ROBUSTNESS NOTE.** The browser `MediaRecorder` in Chrome
> typically produces **`audio/webm`** (Opus), which is **NOT** in Gemini's
> supported list. Do **not** assume WebM works.
> **Decision:** capture mic audio via `getUserMedia` + WebAudio and encode to
> **WAV (PCM, 16 kHz mono)** with a tiny in-house encoder → guaranteed-supported
> format on both the OpenAI-compat (`format: "wav"`) and native paths.
> (Gemini downsamples audio to 16 kbps anyway, so 16 kHz mono is plenty.)
> Fallback only if verified: `MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')`.

## Token cost (cheap)

- **32 tokens per second** of audio (1 min = 1,920 tokens).
- A 5–15 s spoken command ≈ 160–480 tokens. Negligible.
- Inline audio: total request must be **< 20 MB** (seconds of WAV are tiny).
- Max audio length 9.5 h/prompt (irrelevant here).

## Decision for Cicero (voice input)

Two interchangeable transcribers behind one `Transcriber` interface:

1. **`WebSpeechTranscriber`** — `webkitSpeechRecognition`, `lang: 'pt-BR'`.
   Free, instant, no key, no encoding. May be flaky in a side panel / needs net.
2. **`GeminiAudioTranscriber`** — record → WAV → Gemini STT with her key.
   Robust to accents, matches "make gemini understand voice", costs ~pennies.

Recommended runtime: try Web Speech first for instant feedback; if it errors or
is unavailable, fall back to Gemini-audio. Both end at `agent.execute(text)`.
A future `RealtimeSession` (Live API) can replace both behind the same boundary.
