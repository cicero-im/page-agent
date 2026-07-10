# Rate limits — Gemini API

> Source: https://ai.google.dev/gemini-api/docs/rate-limits
> Saved: 2026-06-27 · Last updated upstream: 2026-06-25 UTC

Rate limits regulate requests per timeframe. Measured across:

- **RPM** — requests per minute
- **TPM** — input tokens per minute
- **RPD** — requests per day (resets midnight Pacific)

Exceeding **any** dimension → `429 RESOURCE_EXHAUSTED`. Limits are **per project**
(not per key). Preview/experimental models are more restricted.

## Usage tiers

| Tier       | Qualification               | Notes                                           |
| ---------- | --------------------------- | ----------------------------------------------- |
| **Free**   | Active project / free trial | Most restrictive RPM/RPD; no spend-based limit. |
| **Tier 1** | Link a billing account      | $10 / 10-min spend cap; instant upgrade.        |
| **Tier 2** | $100 paid + 3 days          | $200 / 10-min.                                  |
| **Tier 3** | $1,000 paid + 30 days       | $200 / 10-min.                                  |

Exact numbers live in AI Studio (`https://aistudio.google.com/rate-limit`) and
vary by model/tier; "not guaranteed and actual capacity may vary."

## Why this matters for Cicero ("must not feel broken")

The friend uses **her own key**. An agentic loop makes **many** requests per task
(one LLM call per step, up to ~40 steps), each possibly carrying a screenshot.
On the **Free** tier she can hit RPM/RPD and get `429` mid-task — which to a
scared user looks "broken."

**Mitigations baked into the plan:**

1. **Graceful 429 handling.** `@page-agent/llms` already has `withRetry` (skips
   `AbortError`, honors `InvokeError.retryable`). Ensure 429 is treated as
   retryable with backoff, and on exhaustion speak a calm pt-BR message
   ("Estou um pouco sobrecarregado, vou tentar de novo em instantes…") instead
   of dying.
2. **Keep requests lean.** Default `reasoning_effort: minimal` (already patched);
   screenshots **on-demand + on-error only** (not every step); optional
   `media_resolution` downscale.
3. **Recommend Tier 1.** In `INSTALACAO.md`, suggest linking a billing account
   to the key for reliability (a personal-use agent costs cents/day). Optional,
   but it makes the gift dependable.
4. **Cap steps** (`maxSteps`, default 40) so a runaway task can't burn the daily
   quota in one go.
