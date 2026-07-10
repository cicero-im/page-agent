# OpenAI compatibility — Gemini API

> Source: https://ai.google.dev/gemini-api/docs/openai
> Saved: 2026-06-27 · Last updated upstream: 2026-06-22 UTC
> Licensed under CC BY 4.0; code samples under Apache 2.0 (Google Developers Site Policies).

Gemini models are accessible using the OpenAI libraries (Python and TypeScript /
JavaScript) along with the REST API, by updating three lines of code and using
your [Gemini API key](https://aistudio.google.com/apikey).

```javascript
import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: 'GEMINI_API_KEY',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
})

const response = await openai.chat.completions.create({
    model: 'gemini-3.5-flash',
    messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Explain to me how AI works' },
    ],
})

console.log(response.choices[0].message)
```

What changed? Just three lines:

- `apiKey="GEMINI_API_KEY"` — your actual Gemini API key from Google AI Studio.
- `baseURL="https://generativelanguage.googleapis.com/v1beta/openai/"` — point the OpenAI library at the Gemini endpoint.
- `model="gemini-3.5-flash"` — choose a compatible Gemini model.

## Thinking

Gemini models are trained to think through complex problems. The API exposes
thinking parameters. Mapping from OpenAI's `reasoning_effort`:

| `reasoning_effort` (OpenAI) | `thinking_level` (Gemini 3.1 Pro) | `thinking_level` (Gemini 3.1 Flash-Lite) | `thinking_level` (Gemini 3 Flash) | `thinking_budget` (Gemini 2.5) |
| --------------------------- | --------------------------------- | ---------------------------------------- | --------------------------------- | ------------------------------ |
| `minimal`                   | `low`                             | `minimal`                                | `minimal`                         | `1,024`                        |
| `low`                       | `low`                             | `low`                                    | `low`                             | `1,024`                        |
| `medium`                    | `medium`                          | `medium`                                 | `medium`                          | `8,192`                        |
| `high`                      | `high`                            | `high`                                   | `high`                            | `24,576`                       |

If no `reasoning_effort` is specified, Gemini uses the model's default level/budget.

You can set `reasoning_effort` to `"none"` to disable thinking **for 2.5 models only**.
**Reasoning cannot be turned off for Gemini 2.5 Pro or 3 models.**

`reasoning_effort` and `thinking_level`/`thinking_budget` overlap, so they can't
be used at the same time. Use the `extra_body` field to include native Gemini
fields such as `thinking_config`:

```javascript
const response = await openai.chat.completions.create({
    model: 'gemini-3.5-flash',
    messages: [{ role: 'user', content: 'Explain to me how AI works' }],
    extra_body: {
        google: {
            thinking_config: { thinking_level: 'low', include_thoughts: true },
        },
    },
})
```

## Streaming

```javascript
const completion = await openai.chat.completions.create({
    model: 'gemini-3.5-flash',
    messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' },
    ],
    stream: true,
})
for await (const chunk of completion) {
    console.log(chunk.choices[0].delta.content)
}
```

## Function calling

```javascript
const messages = [{ role: 'user', content: "What's the weather like in Chicago today?" }]
const tools = [
    {
        type: 'function',
        function: {
            name: 'get_weather',
            description: 'Get the weather in a given location',
            parameters: {
                type: 'object',
                properties: {
                    location: {
                        type: 'string',
                        description: 'The city and state, e.g. Chicago, IL',
                    },
                    unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
                },
                required: ['location'],
            },
        },
    },
]

const response = await openai.chat.completions.create({
    model: 'gemini-3.5-flash',
    messages: messages,
    tools: tools,
    tool_choice: 'auto',
})
```

## Image understanding

Pass images via `image_url` with a `data:image/...;base64,...` URL (Gemini is
natively multimodal — relevant for the agent's vision capability).

```javascript
const messages = [
    {
        role: 'user',
        content: [
            { type: 'text', text: 'What is in this image?' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
        ],
    },
]
const response = await openai.chat.completions.create({ model: 'gemini-3.5-flash', messages })
```

## Audio understanding (transcription via chat)

Send audio inline with `input_audio` and ask the model to transcribe — this is
the "STT via Gemini API" route (relevant to Decision A / voice input).

```javascript
const base64Audio = Buffer.from(fs.readFileSync('file.wav')).toString('base64')
const response = await client.chat.completions.create({
    model: 'gemini-3.5-flash',
    messages: [
        {
            role: 'user',
            content: [
                { type: 'text', text: 'Transcribe this audio' },
                { type: 'input_audio', input_audio: { data: base64Audio, format: 'wav' } },
            ],
        },
    ],
})
console.log(response.choices[0].message.content)
```

## Structured output

Supports `response_format` with a Zod/JSON schema via
`openai.chat.completions.parse(...)` (`zodResponseFormat`).

## Embeddings

`gemini-embedding-2-preview` (multimodal) or `gemini-embedding-001` (text-only).

## Batch API

Supports creating a batch, monitoring status, and viewing results in OpenAI
JSONL format. Upload/download use the native `genai` client.

## Flex and Priority inference

Matches OpenAI's `service_tier` parameter (`flex`, `priority`; default
`standard`).

## Enable Gemini features with `extra_body`

Features not in OpenAI models can be enabled via `extra_body`:

| Parameter                                                                                                                                                             | Type   | Endpoint   | Description                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `cached_content`                                                                                                                                                      | Text   | Chat       | Gemini general content cache.                                                                                    |
| `thinking_config`                                                                                                                                                     | Object | Chat       | Gemini ThinkingConfig.                                                                                           |
| `aspect_ratio`                                                                                                                                                        | Text   | Images     | Output aspect ratio (`"16:9"`, `"1:1"`, `"9:16"`).                                                               |
| `generation_config`                                                                                                                                                   | Object | Images     | Gemini generation config object.                                                                                 |
| `safety_settings`                                                                                                                                                     | List   | **Images** | Custom safety threshold filters (e.g. `[{"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"}]`). |
| `tools`                                                                                                                                                               | List   | Images     | Enables grounding. Only for `gemini-3-pro-image-preview`.                                                        |
| (video params: `resolution`, `duration_seconds`, `frame_rate`, `negative_prompt`, `seed`, `style`, `person_generation`, `reference_images`, `image`, `last_frame`, …) |        | Video      |                                                                                                                  |

> ⚠️ **NOTE for the Cicero plan:** the docs list `safety_settings` under the
> **Images** endpoint, **not Chat**. The OpenAI-compat layer "silently ignores"
> parameters it doesn't recognize. So injecting `safety_settings` into a
> `chat/completions` body is unlikely to take effect. See `03-safety-settings.md`
> — for Gemini 2.5/3 the adjustable filters are **OFF by default** anyway, so the
> plan's "safety OFF" work is most likely unnecessary.

Example using `extra_body` (cached_content):

```python
stream = client.chat.completions.create(
    model="gemini-3.5-flash",
    messages=[{"role": "user", "content": "Summarize the video"}],
    stream=True,
    extra_body={ 'extra_body': { 'google': { 'cached_content': "cachedContents/…" } } }
)
```

## List models / Retrieve a model

```javascript
const list = await openai.models.list() // GET /v1beta/openai/models
const model = await openai.models.retrieve('gemini-3.5-flash')
```

## Current limitations

Support for the OpenAI libraries is still in beta while feature support is
extended.
