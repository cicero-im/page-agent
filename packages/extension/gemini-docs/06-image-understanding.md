# Image understanding (vision) — Gemini API

> Source: https://ai.google.dev/gemini-api/docs/image-understanding
> Saved: 2026-06-27 · Last updated upstream: 2026-06-22 UTC

Gemini models are natively multimodal: captioning, classification, visual Q&A,
object detection, segmentation — no specialized model needed. **Used by Cicero
for "see the screen".**

## Passing images (the way Cicero will use it)

Via the **OpenAI-compat** chat endpoint (what `@page-agent/llms` speaks), images
are passed as `image_url` content parts with a `data:` URL — see
`01-openai-compatibility.md`:

```javascript
content: [
    { type: 'text', text: "Here is the current screen. Find the 'Enviar' button." },
    { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
]
```

`chrome.tabs.captureVisibleTab()` returns a `data:image/png;base64,…` (or JPEG)
URL directly — **no conversion needed**.

## Supported image formats

PNG `image/png` · JPEG `image/jpeg` · WEBP `image/webp` · HEIC · HEIF.
(`captureVisibleTab` produces PNG or JPEG — both supported.)

## Token cost (cheap — matters for a "must not feel broken" gift)

- **258 tokens** if both dimensions ≤ 384 px.
- Larger images are tiled into 768×768 tiles, **258 tokens per tile**.
- Rough tiles: crop unit ≈ `floor(min(w,h)/1.5)`; divide each dim by it, multiply.
    - e.g. 960×540 → crop unit 360 → 3×2 = **6 tiles ≈ 1,548 tokens**.
- A typical 1280×800 side-panel screenshot ≈ a few thousand tokens — negligible
  against the 1M input window. Good: on-demand + on-error screenshots are affordable.

## Limits & best practices

- Max **3,600 image files** per request (we send 1).
- Inline request total must be **< 20 MB** (a JPEG screenshot is tens–hundreds of KB).
- Gemini 3 `media_resolution` param caps tokens per image (can downscale to save
  tokens/latency). Optional tuning knob.
- **Best practice: put the text prompt BEFORE the image** in the content array.
- Use clear, non-blurry, correctly-rotated images (screenshots are fine).

## Decision for Cicero

- Capture with `captureVisibleTab` → JPEG (smaller) at default quality.
- Optionally downscale very large screens to keep tiles/tokens modest.
- Always place instruction text before the image part.
