# Instructions for Coding Assistants

## Project Overview

**Page Agent** is an AI-powered browser-automation agent. A user states a goal in
natural language; the agent observes the live page, reasons, and drives the DOM
(clicks, types, scrolls, selects) until the goal is reached. It ships as:

- a drop-in **npm library** (`page-agent`) with a built-in UI Panel,
- a **browser extension** (WXT + React) that automates real tabs,
- a **docs/landing website**, and
- a headless **core** (`@page-agent/core`) and several internal packages.

This is a **monorepo** managed by npm workspaces.

### Packages

| Package (npm)                      | Dir                       | Role                                                                                |
| ---------------------------------- | ------------------------- | ----------------------------------------------------------------------------------- |
| `page-agent`                       | `packages/page-agent/`    | ⭐ Main entry class with UI Panel + CDN demo build. Extends `PageAgentCore`.         |
| `@page-agent/core`                 | `packages/core/`          | ⭐ Headless agent loop (Re-Act), tools, prompts. No UI.                             |
| `@page-agent/page-controller`      | `packages/page-controller/` | DOM extraction, element interactions, optional SimulatorMask. No LLM dependency.  |
| `@page-agent/llms`                 | `packages/llms/`          | LLM client (OpenAI-compatible) + retry. Defines the `Tool` / `MacroToolInput` shape. |
| `@page-agent/ui`                   | `packages/ui/`            | Panel + i18n. **Framework-free raw DOM**, decoupled via `PanelAgentAdapter`.        |
| `@page-agent/ext` (private)        | `packages/extension/`     | Browser extension (WXT). Multi-tab agent over chrome.runtime messaging.             |
| `@page-agent/website` (private)    | `packages/website/`       | React docs/landing site. **Has its own `AGENTS.md` — follow it when editing it.**   |
| `@page-agent/mcp` (private)        | `packages/mcp/`           | MCP hub bridge + launcher HTML.                                                     |

`workspaces` in the root `package.json` are intentionally in **topological
order** (controller → ui → llms → core → page-agent → …). Keep that order when
adding a package.

## Toolchain Requirements

- **Node** `^22.22.1 || >=24`, **npm** `^11.6.3` (enforced in `engines`; CI uses Node 24).
- The repo is ESM (`"type": "module"`). Config scripts are `.js` using `import`.
- TypeScript **6** is pinned via root `overrides` (do not let a sub-package drift).

## Development Commands

```bash
npm install                     # one-time; extension runs `wxt prepare` postinstall
npm start                       # website dev server
npm run dev:ext                 # extension dev (WXT)
npm run dev:demo                # page-agent IIFE demo dev build

npm run build                   # full pipeline: cleanup + parallel build of all packages
npm run build:libs              # build only the library workspaces (skip website/ext)
npm run build:website           # build the docs site
npm run build:ext               # `wxt zip` → packaged extension

npm run typecheck               # tsc --noEmit on tsconfig.typecheck.json + extension tsconfig
npm test                        # vitest run across all workspaces that have a "test" script
npm run lint                    # eslint .
npm run ci                      # ⭐ the full CI gate (see below)
npm run cleanup                 # rm -rf packages/*/dist packages/*/.output
```

### The CI gate: `npm run ci`

`scripts/ci.js` is the canonical "is this shippable?" check (also what GitHub
Actions runs). It does, in order:

1. **commitlint** — skipped on `main`; on branches it lints commits from
   `origin/main..HEAD`. (Conventional Commits are enforced — see Committing.)
2. **lint + format-check + typecheck + test** — run **in parallel**.
3. **build** — unless you pass `--no-build`.

So locally: `npm run ci` runs everything; `npm run ci --no-build` is faster when
you only changed logic. `npx prettier --check .` is part of CI — formatting must
be clean or CI fails.

## Architecture & Control Flow

### The Re-Act agent loop (`PageAgentCore.execute`)

Each step is: **observe → think (LLM) → act (tool)**, looped until `done` or `maxSteps`.

```
execute(task)
 └─ while true:
     1. OBSERVE   pageController.getBrowserState()  →  simplified HTML + page info
     2. THINK     llm.invoke(messages, {AgentOutput: MacroTool})  →  reflection + action
     3. ACT       MacroTool.execute(action)  →  dispatches to the named sub-tool
        └─ if action is `done` → break with {success, data}
     4. step++; if step > maxSteps (default 40) → fail
```

Key files: `packages/core/src/PageAgentCore.ts` (loop + MacroTool packing),
`packages/core/src/tools/index.ts` (tool definitions),
`packages/core/src/prompts/system_prompt.md` (imported via `?raw`).

### ⭐ The "MacroTool" / reflection-before-action model (central abstraction)

This is the most important non-obvious pattern. **The LLM never calls individual
tools.** Instead, every step the LLM must call a single synthesized tool —
`AgentOutput` — whose schema is built at runtime by merging **all** registered
tools into one `z.union`. Its input is:

```ts
{
  evaluation_previous_goal?: string  // reflect on last action
  memory?: string                    // carry key facts forward
  next_goal?: string                 // intent for this action
  action: { <toolName>: <toolInput> } // exactly one tool, selected by key
}
```

`PageAgentCore.#packMacroTool()` rebuilds this union from `this.tools` each step.
Consequences:

- Adding/removing/overriding a tool **automatically** changes the LLM's action
  schema — no prompt edits needed.
- The reflection fields become the agent's short-term memory and are emitted as
  `HistoricalEvent` (`type: 'step'`).
- The `done` tool is special-cased in the loop (it breaks the loop; its
  `execute` body never really runs).

### Two information streams (do not confuse them)

| Stream        | Where                              | In LLM context? | Purpose                                              |
| ------------- | ---------------------------------- | --------------- | ---------------------------------------------------- |
| **History**   | `agent.history` (`HistoricalEvent[]`) | **Yes**         | Persistent agent memory across steps.                |
| **Activity**  | `'activity'` event (`AgentActivity`) | **No**          | Transient UI feedback (thinking/executing/retrying). |

Events on `PageAgentCore` (an `EventTarget`): `statuschange`, `historychange`,
`activity`, `dispose`. If you add UI-visible transient feedback, use `activity`;
if you add something the LLM should remember, push to `history`.

### Cooperative cancellation (AbortSignal everywhere)

A single `AbortController` per task threads an `AbortSignal` through: the LLM
`fetch`, **every tool** (via `ToolContext.signal`), and async callbacks
(`onAskUser`). Rules:

- **Tools MUST honor `signal`** — check `signal.throwIfAborted()` / pass it to
  `fetch`, `waitFor`, loops. The `execute_javascript` tool even documents that
  the in-page script gets a `signal` in scope.
- The controller is aborted **without a reason**, so `signal.reason` stays a
  standard `AbortError` (the loop special-cases `error.name === 'AbortError'`
  → final status `'stopped'` instead of `'error'`).
- `stop()` aborts then `await`s the run settling. **Never `await stop()` inside
  a lifecycle hook** — it would deadlock.

### PageController ↔ PageAgent (async-only contract)

`PageController` exposes **only async** methods. This is deliberate: it lets the
**exact same `PageAgentCore`** drive either a local in-page controller or a
remote one. The extension's `RemotePageController`
(`packages/extension/src/agent/`) implements the same method names but forwards
each call through `chrome.runtime.sendMessage` to a content script in the target
tab.

```ts
// PageAgent never knows or cares if the controller is local or remote:
await this.pageController.getBrowserState()
await this.pageController.clickElement(index)
await this.pageController.inputText(index, text)
await this.pageController.scroll({ down: true, numPages: 1 })
```

### DOM pipeline (`page-controller`)

1. `dom/dom_tree/index.js` walks the live DOM → `FlatDomTree` (indexed interactive elements). **This file is plain `.js` (ported from the Python `browser-use` project) with a sibling `.d.ts` — do not "fix" it by rewriting to TS.**
2. `dom/index.ts` `flatTreeToString()` dehydrates the tree into indexed text for the LLM (e.g. `[0]<a aria-label=Home />`).
3. Interactive elements get `[index]` labels; the agent references them by index.
4. `getPageInfo()` computes viewport/page size and scroll hints ("… N pixels below …").

`patchReact(this)` and antd patches (`patches/`) run on construction to improve
extraction on React/antd sites.

### Extension: distributed multi-tab agent

```
sidepanel/background (agent)  ──chrome.runtime.sendMessage──▶  content script (in tab)
   PageAgentCore + RemotePageController                          real PageController + DOM
   + TabsController (open/switch tabs)                           + mask (via storage polling)
```

Gotchas specific to the extension:

- **`execute_javascript` is intentionally NOT implemented** in
  `RemotePageController` — an `AbortSignal` cannot cross execution contexts.
- The **mask is not driven by the controller** there; the content script
  observes it via storage polling, so `showMask/hideMask/dispose` are no-ops on
  the remote side.
- `isContentScriptAllowed(url)` blocks restricted schemes (`chrome://`, `about:`,
  `file://`, etc.) — operations on those pages return a friendly error instead
  of failing silently.

### UI Panel is framework-free

`@page-agent/ui`'s `Panel` is **raw DOM manipulation** (`document.createElement`,
CSS Modules via `*.module.css`) — **not React**. It depends on `PageAgent` only
through the minimal `PanelAgentAdapter` interface (`packages/ui/src/panel/types.ts`),
so any object implementing that interface can drive the Panel. The website and
extension UIs are React; the in-page library Panel is not.

## Key File Reference

### `packages/core/`

| File                      | Notes                                                              |
| ------------------------- | ------------------------------------------------------------------ |
| `src/PageAgentCore.ts`    | ⭐ The Re-Act loop, MacroTool packing, event/lifecycle system.      |
| `src/tools/index.ts`      | Built-in tools + `tool()` helper + `PageAgentTool`/`ToolContext`.  |
| `src/types.ts`            | `AgentConfig`, `MacroToolInput`, `AgentReflection`, history types. |
| `src/prompts/system_prompt.md` | System prompt, imported as a string via `?raw`.               |
| `src/utils/`              | `assert`, `waitFor`, `uid`, `fetchLlmsTxt`, `normalizeResponse`, `suppress`. |

### `packages/page-controller/`

| File                          | Notes                                                            |
| ----------------------------- | ---------------------------------------------------------------- |
| `src/PageController.ts`       | ⭐ Async DOM state + actions; optional `SimulatorMask`.          |
| `src/actions.ts`              | `clickElement`, `inputTextElement`, `selectOptionElement`, scroll. |
| `src/dom/dom_tree/index.js`   | DOM extraction engine (plain JS, ported).                        |
| `src/dom/index.ts`            | `getFlatTree`, `flatTreeToString`, `DomConfig`.                  |
| `src/mask/SimulatorMask.ts`   | Overlay blocking user input during automation.                   |
| `src/patches/react.ts`, `antd.ts` | Extraction compatibility patches.                             |

### `packages/llms/`

| File               | Notes                                                          |
| ------------------ | -------------------------------------------------------------- |
| `src/index.ts`     | ⭐ `LLM` class, `parseLLMConfig`, `withRetry` (skips `AbortError` & non-retryable `InvokeError`). |
| `src/OpenAIClient.ts` | OpenAI-compatible tool-calling client.                      |
| `src/types.ts`     | `LLMConfig`, `Tool`, `Message`, `InvokeResult`.               |
| `src/errors.ts`    | `InvokeError` + `InvokeErrorTypes` (with `.retryable` flag).  |

### `packages/page-agent/`

| File              | Notes                                                                 |
| ----------------- | --------------------------------------------------------------------- |
| `src/PageAgent.ts`| ⭐ Composes `PageController` + `Panel` onto `PageAgentCore`; re-exports core types. |
| `src/demo.ts`     | IIFE CDN entry. Reads config from `<script>` URL params or `import.meta.env`. |

## Configuration & Extensibility

`AgentConfig` (in `core/src/types.ts`, extends `LLMConfig`) is the main surface:

- **`customTools`** — `Record<string, PageAgentTool | null>`. Add tools, override
  built-ins by name, or **set one to `null` to remove it**.
- **`experimentalScriptExecutionTool`** — gates the `execute_javascript` tool
  (off by default; can bypass safeguards/data-masking).
- **`experimentalLlmsTxt`** — fetch `/llms.txt` from the current origin once per
  task and include it as context.
- **`transformPageContent(content)`** — mutate simplified page text before the
  LLM sees it (e.g. mask phone numbers, PII). This is the supported data-masking hook.
- **`customSystemPrompt`** — fully replace the system prompt (use with caution).
- **`instructions`** — `{ system?, getPageInstructions?(url) }` for static + per-page guidance.
- **Lifecycle hooks** (`@experimental`): `onBeforeTask`, `onAfterTask`,
  `onBeforeStep`, `onAfterStep`, `onDispose`. Hooks may be async; throwing in a
  hook surfaces as an external error.
- **`maxSteps`** (default 40), **`stepDelay`** (default 0.4s), **`enableMask`**
  (default `true` in `PageAgent`, `false` in standalone `PageController`).

`PageControllerConfig` (`DomConfig` + `enableMask`): `viewportExpansion`
(see gotcha), `interactiveBlacklist`/`interactiveWhitelist` (Elements or lazy
`() => Element`), `includeAttributes`, `keepSemanticTags`, highlight opacities.

## Adding New Features

### New agent tool

1. Implement with `tool({ description, inputSchema: z.object({...}), execute })`
   in `packages/core/src/tools/index.ts` (or register via `customTools` at runtime).
2. If it needs DOM ops, **add the method to `PageController` first** (and to
   `RemotePageController` if the extension should support it).
3. `execute` runs with `this: PageAgentCore`; call `this.pageController.<method>()`.
4. Honor `ctx.signal` for cancellation. Return a human/LLM-readable string.
5. The tool is automatically picked up by `#packMacroTool()` — no prompt edit needed.

### New PageController action

1. Add the implementation in `packages/page-controller/src/actions.ts`.
2. Expose it as an `async` method on `PageController`.
3. Export from `packages/page-controller/src/index.ts`.
4. Mirror it in `RemotePageController` (+ content-script handler) if the extension needs it.

## Testing

- **Framework:** Vitest (unit tests only; E2E will live in a future `packages/e2e/` with Playwright).
- **Location:** co-located — `src/foo.test.ts` next to `src/foo.ts`.
- **Coverage today:** `packages/llms`, `packages/core`, `packages/page-controller` have tests; others incrementally.
- **Adding tests to a new package:** create a `vitest.config.js` (template:
  `packages/llms/vitest.config.js` — note `silent: 'passed-only'`) and add a
  `"test": "vitest run"` script. Root `npm test` and `node scripts/ci.js` pick
  it up through workspaces. `happy-dom` is available as a dev dependency.

```bash
npm test                         # all packages with a test script
npm test -w @page-agent/llms     # single package
cd packages/llms && npx vitest   # watch mode in one package
```

## Code Style & Formatting

Enforced by **prettier + eslint + lint-staged (husky pre-commit)**. CI runs
`prettier --check .`, so formatting must be clean.

- **Indentation gotcha:** source files use **TABS**, but **`.md` and `.json` use
  4 spaces** (see the `overrides` in root `package.json`). Match the file you're in.
- Prettier config: `singleQuote`, **no semicolons** (`semi: false`), `printWidth 100`,
  `trailingComma: 'es5'`, **tabs**, import auto-sorting via
  `@trivago/prettier-plugin-sort-imports` (order: third-party → `@/` → relative → `.css` last).
- ESLint: `strictTypeChecked` + `eslint-react`, but **many strict rules are
  relaxed to `off`** for rapid iteration (`no-explicit-any`, `no-unsafe-*`,
  `no-floating-promises`, `no-unused-vars`, …). Don't be alarmed by `any`.
- `packages/*/src/components/ui` (shadcn/Magic UI) is **globally eslint-ignored** —
  do not hand-edit those in the website.

## Committing

- **Conventional Commits** are enforced by `commitlint` (husky `commit-msg` hook
  + CI). `subject-case` is relaxed. Examples: `feat: ...`, `fix(scope): ...`.
- `lint-staged` runs prettier+eslint on staged JS/TS/CSS/TSX on pre-commit.
- When you commit, follow the conventional format; otherwise CI's commitlint step fails.

## Publishing / Source-first monorepo (important gotcha)

Library `package.json` files point `main`/`types`/`exports` at **`src/*.ts`**
during development (so workspaces consume source directly — no build needed to
iterate). At publish time:

1. `prepublishOnly` → `scripts/pre-publish.js`: backs up `package.json` to
   `.bak`, promotes `publishConfig` fields to top-level (swapping to `dist/`),
   copies `LICENSE` (+ `README.md` for the main package).
2. `postpublish` → `scripts/post-publish.js`: restores the original `package.json`.

**Implication:** always edit `src/`, never `dist/`. `dist/` is build output and
is gitignored. Version is kept in sync across all packages by
`scripts/sync-version.js` (`npm run version`).

Build outputs: `dist/esm` (npm ES lib), `dist/lib` (bundled lib), `dist/iife`
(CDN demo bundle for `page-agent`).

## Other Non-Obvious Gotchas

- **`zod/v4` subpath:** import schemas as `import * as z from 'zod/v4'`. `zod` is
  a peer dependency (`^3.25.0 || ^4.0.0`) — consumers can use either major.
- **`?raw` markdown imports:** `import SYSTEM_PROMPT from './prompts/system_prompt.md?raw'`
  requires an `env.d.ts` declaring `declare module '*.md?raw'`. Each package that
  does this has its own `src/env.d.ts`.
- **`viewportExpansion` quirk:** default is **`-1`** (full page, no viewport
  restriction). `0` = viewport only. Because `isTopElement` relies on
  `document.elementFromPoint` (which returns null off-screen), intermediate
  positive values "have no practical use" — effectively only `-1` vs `0` differ.
- **New-element tracking:** `dom/index.ts` marks interactive elements `isNew`
  using a `WeakMap<HTMLElement, string>` keyed on URL, so the agent can spot
  freshly-appeared elements. It's intentionally simple (see the `@todo` there).
- **`fetch` binding:** `LLMConfig.customFetch` defaults to `fetch.bind(globalThis)`
  because unbound `fetch` is illegal in the bundled runtime.
- **Console noise is expected:** the agent loop logs heavily with `chalk`
  (👀 Observing / 🧠 Thinking / step groups). Tests use `silent: 'passed-only'`.
- **i18n:** UI languages are `'en-US' | 'zh-CN'`. Extension locales live in
  `packages/extension/public/_locales/{en,zh_CN}/messages.json`; the in-page
  Panel uses `@page-agent/ui`'s `I18n`.
- **Website:** editing `packages/website/`? Read and follow
  `packages/website/AGENTS.md` (wouter with `base="/page-agent"`, SPA route
  array in `vite.config.js`, shadcn/ui in `src/components/ui` — do not hand-edit).

## Code Standards

- Explicit typing for exported/public APIs (internal code freely uses `any`).
- Every change should implement the feature **and** improve codebase quality.
- All code and comments must be in **English**.
- Do **not** hide errors or risks — surface them visibly and actionably.
- **Traceability and predictability are more important than success rate.**
