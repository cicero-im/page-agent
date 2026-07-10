# Safety settings — Gemini API

> Source: https://ai.google.dev/gemini-api/docs/safety-settings
> Saved: 2026-06-27 · Last updated upstream: 2026-06-01 UTC
> Licensed under CC BY 4.0; code samples under Apache 2.0.

The Gemini API provides adjustable safety filters across four categories.

## Safety filters

| Category          | Description                                                                  |
| ----------------- | ---------------------------------------------------------------------------- |
| Harassment        | Negative or harmful comments targeting identity and/or protected attributes. |
| Hate speech       | Content that is rude, disrespectful, or profane.                             |
| Sexually explicit | References to sexual acts or other lewd content.                             |
| Dangerous         | Promotes, facilitates, or encourages harmful acts.                           |

In addition to adjustable filters, there are built-in protections against core
harms (e.g. child safety) that are **always blocked and cannot be adjusted**.

## Content safety filtering level

Probability levels: `HIGH`, `MEDIUM`, `LOW`, `NEGLIGIBLE`. The API blocks on
_probability_ of being unsafe, not severity.

## Safety filtering per request

> **KEY FACT for the Cicero plan:**
> "Due to the model's inherent safety, additional filters are **Off** by default.
> If you choose to enable them, you can configure the system to block content…
> The default model behavior covers most use cases."
>
> And: **"If the threshold is not set, the default block threshold is Off for
> Gemini 2.5 and 3 models."**
>
> ➜ Therefore, for `gemini-3.5-flash` the adjustable safety filters are already
> OFF unless we opt in. The plan does **not** need to inject `BLOCK_NONE` /
> `OFF`. (And per `01-openai-compatibility.md`, `safety_settings` via the
> OpenAI-compat layer is only documented for the **Images** endpoint, so it
> likely wouldn't apply to chat anyway.)

| Threshold (AI Studio) | Threshold (API)                    | Description                           |
| --------------------- | ---------------------------------- | ------------------------------------- |
| Off                   | `OFF`                              | Turn off the safety filter            |
| Block none            | `BLOCK_NONE`                       | Always show regardless of probability |
| Block few             | `BLOCK_ONLY_HIGH`                  | Block when high probability           |
| Block some            | `BLOCK_MEDIUM_AND_ABOVE`           | Block when medium or high             |
| Block most            | `BLOCK_LOW_AND_ABOVE`              | Block when low, medium or high        |
| N/A                   | `HARM_BLOCK_THRESHOLD_UNSPECIFIED` | Use default threshold                 |

## Adjust safety settings (native API)

Native (`generateContent`) usage — **not** the OpenAI-compat chat body:

```javascript
import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({})

const safetySettings = [{ category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' }]

const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: 'Some potentially unsafe prompt.',
    config: { safetySettings },
})
```

REST native endpoint:

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" -H "Content-Type: application/json" -X POST \
  -d '{ "safetySettings": [{"category":"HARM_CATEGORY_HATE_SPEECH","threshold":"BLOCK_LOW_AND_ABOVE"}],
        "contents": [{"parts":[{"text":"…"}]}] }'
```

## Safety feedback

`generateContent` returns `promptFeedback.blockReason` (prompt blocked) and per
candidate `finishReason` (`SAFETY`) + `safetyRatings`. Blocked content is not
returned.
