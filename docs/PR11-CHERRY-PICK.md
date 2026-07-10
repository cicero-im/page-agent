# PR #11 cherry-pick inventory

**Context**

- PR: https://github.com/cicero-im/page-agent/pull/11
- Source commit: `ea8ed23` (`origin/arthrod_new`) — single mega-commit “enhancements”
- Base: current `main` (maintainers through 1.12.1)
- Integration branch: `arthrod_cherry` (rebuilt from clean `main`)

**Tags**

| Tag            | Meaning                                                     |
| -------------- | ----------------------------------------------------------- |
| **KEEP**       | Apply onto main as customization                            |
| **KEEP+MERGE** | Keep intent; re-apply carefully without undoing maintainers |
| **REVIEW**     | Decision needed                                             |
| **SKIP**       | Maintainer conflict, noise, or accidental regression        |
| **DEFER**      | Later, after foundations                                    |

---

## Progress

| Unit                                                                      | Status  | Commit    |
| ------------------------------------------------------------------------- | ------- | --------- |
| Inventory written                                                         | done    | `55ac8c5` |
| A1–A5 core vision + error recovery                                        | done    | `55ac8c5` |
| B1 PageController screenshot stub                                         | done    | `55ac8c5` |
| Multimodal `ContentPart` types (minimal llms)                             | done    | `55ac8c5` |
| C1–C4 remote screenshot + executeJavascript + context-invalidated + tests | done    | `65c1ab6` |
| Remaining groups                                                          | pending | —         |

---

## A. Core agent features (vision + resilience)

| #   | Change                                               | Files                                  | Tag      | Notes                          |
| --- | ---------------------------------------------------- | -------------------------------------- | -------- | ------------------------------ |
| A1  | `experimentalVisionTool` + `capture_screenshot` tool | `core/types.ts`, `core/tools/index.ts` | **KEEP** |                                |
| A2  | `alwaysSendScreenshot`                               | `core/types.ts`, `PageAgentCore.ts`    | **KEEP** | Opt-in token cost              |
| A3  | `errorRecovery`                                      | `core/types.ts`, `PageAgentCore.ts`    | **KEEP** |                                |
| A4  | `attachImage` / `#pendingImages` multimodal channel  | `PageAgentCore.ts`                     | **KEEP** | Needs `ContentPart` on Message |
| A5  | `autoFixer`: guard `message.content` as string       | `core/utils/autoFixer.ts`              | **KEEP** |                                |
| A6  | system_prompt: `don't` → `dont`                      | system prompts                         | **SKIP** | Typo regression                |
| A7  | core package.json version/reformat                   | `core/package.json`                    | **SKIP** | Keep 1.12.1                    |

**Dependencies applied with A (not full groups):**

- Minimal `ContentPart` + widen `Message.content` in `@page-agent/llms` (not the full H llms rewrite)
- B1: `PageController.captureScreenshot()` stub → `null`

---

## B. PageController

| #   | Change                                 | Tag              | Notes                  |
| --- | -------------------------------------- | ---------------- | ---------------------- |
| B1  | `captureScreenshot()` → `null` in-page | **KEEP**         | Contract for extension |
| B2  | eslint-disable on `execCommand`        | **REVIEW**       |                        |
| B3  | DOM tree changes                       | **REVIEW**       |                        |
| B4  | DOM tree tests                         | **KEEP** with B3 |                        |
| B5  | package.json version                   | **SKIP**         |                        |

---

## C. Extension: remote controller + tabs

| #   | Change                                        | Tag                       | Notes                              |
| --- | --------------------------------------------- | ------------------------- | ---------------------------------- |
| C1  | `captureScreenshot` via `captureVisibleTab`   | **KEEP**                  | Required for vision                |
| C2  | `executeJavascript` on RemotePageController   | **KEEP+MERGE**            | Best-effort; signal cannot cross   |
| C3  | Content script context-invalidated quiet stop | **KEEP**                  |                                    |
| C4  | Remote controller tests                       | **KEEP**                  |                                    |
| C5  | TabsController reintroduces long-lived ports  | **SKIP bulk**             | Reverts maintainer #596 pull model |
| C6  | Token helpers (user auth + hub token)         | **KEEP**                  |                                    |
| C7  | Background tokens + `chrome.commands`         | **KEEP** (no port revert) |                                    |

---

## D. Extension: toolbelts

| #   | Change                                  | Tag      |
| --- | --------------------------------------- | -------- |
| D1  | helperTools (click_text, fill_field, …) | **KEEP** |
| D2  | browserTools (download, bookmark, …)    | **KEEP** |
| D3  | Wire tools in MultiPageAgent / useAgent | **KEEP** |
| D4  | Gemini defaults + pt-BR persona         | **KEEP** |
| D5  | extension system_prompt typo            | **SKIP** |

---

## E. Extension: voice

| #     | Change                           | Tag        |
| ----- | -------------------------------- | ---------- |
| E1–E2 | Transcriber/Speaker + wavEncoder | **KEEP**   |
| E3    | realtime.ts stub                 | **REVIEW** |
| E4–E5 | Sidepanel mic/TTS, pt-BR         | **KEEP**   |

---

## F. Extension: UI, brand, packaging

| #       | Change                                           | Tag                                 |
| ------- | ------------------------------------------------ | ----------------------------------- |
| F1–F6   | ConfigPanel, hub, locales, icons, install guides | **KEEP** if Cicero product          |
| F7      | wxt permissions + commands + zip name            | **KEEP+MERGE**                      |
| F8      | CICERO_PLAN.md                                   | **REVIEW**                          |
| F9      | gemini-docs vendor dump                          | **REVIEW/SKIP**                     |
| F10     | vitest for extension                             | **KEEP** (no version downgrade)     |
| F11–F12 | docs URLs; package version                       | **KEEP** rebrand / **SKIP** version |

---

## G. MCP

| #     | Change                   | Tag                 |
| ----- | ------------------------ | ------------------- |
| G1–G3 | Hub token, stop(), tests | **KEEP**            |
| G4    | README rebrand           | **KEEP** if rebrand |
| G5    | package version          | **SKIP**            |

---

## H. `@page-agent/llms` (high conflict)

| #     | Change                                      | Tag                                          |
| ----- | ------------------------------------------- | -------------------------------------------- |
| H1–H4 | Delete live tests, rewrite modelPatch, etc. | **SKIP**                                     |
| H5–H6 | constants / multimodal                      | **REVIEW** — only minimal ContentPart with A |
| H7    | package version                             | **SKIP**                                     |

---

## I. UI motion-css

| #   | Change            | Tag              |
| --- | ----------------- | ---------------- |
| I1  | Re-add motion-css | **SKIP** default | Removed by maintainers #583 |

---

## J. Website rebrand

| #     | Change           | Tag                       |
| ----- | ---------------- | ------------------------- |
| J1–J2 | Hero/docs Cicero | **KEEP+MERGE** if rebrand |
| J3–J4 | misc / version   | **REVIEW** / **SKIP**     |

---

## K. Root meta / lockfiles

| #      | Change                                   | Tag                         |
| ------ | ---------------------------------------- | --------------------------- |
| K1     | package.json rebrand vs version/deps     | **KEEP+MERGE** rebrand only |
| K2–K3  | lockfiles / bun+pnpm locks               | **SKIP**                    |
| K4–K5  | tsconfig reformat / eslint no-deprecated | **SKIP** / **REVIEW**       |
| K6     | README rebrand                           | **KEEP** if rebrand         |
| K7     | CHANGELOG wipe 1.11–1.12                 | **SKIP**                    |
| K8–K10 | docs URLs, AGENTS.md, CONTRIBUTING       | **REVIEW**                  |

---

## Maintainer work to preserve

1. **#596 / #599** — stateless TabsController (pull, not ports) + tab status
2. **#610** — live model tests behind `test:live`
3. **#611** — model list + provider-aware `modelPatch`
4. **#583** — motion-css removed
5. **1.11–1.12** changelog and version **1.12.1**
6. Current dependency pins (do not roll back)

---

## Safe pick order

```
main
  → ① A (+ minimal ContentPart + B1 stub)   ← current
  → ② C1/C3/C4 remote screenshot
  → ③ C6 tokens + C7 commands (no C5 ports)
  → ④ D helperTools + browserTools + wire-up
  → ⑤ E voice
  → ⑥ F UI/brand/wxt
  → ⑦ G MCP hub token
  → ⑧ J/K rebrand (optional)
  ✗ bulk H llms, I motion-css, C5 ports, lockfiles, CHANGELOG wipe
```
