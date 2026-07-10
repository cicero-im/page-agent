/**
 * High-level "helper toolbelt" for the Cicero extension.
 *
 * These tools are intentionally forgiving so a small model (gemini-3.5-flash) can
 * drive real-world pages (Gmail, bank/court portals) without writing fragile code.
 *
 * IMPORTANT (verified by live dogfood): we never run JS as a string in the page's
 * MAIN world — `unsafe-eval` CSP blocks that on the very sites the user cares about.
 * Every tool instead injects a real function via
 * `chrome.scripting.executeScript({ world: 'ISOLATED', func, args })`, which is
 * CSP-exempt (extension-privileged injection) and still has full DOM access.
 *
 * Each injected `func` is serialized with `Function.prototype.toString()`, so it
 * MUST be fully self-contained: it can only use its own arguments and page globals,
 * never module-scope variables. All helpers are therefore inlined inside each func.
 */
import { type PageAgentCore, type PageAgentTool, tool } from '@page-agent/core'
import * as z from 'zod/v4'

/** Friendly pt-BR message returned when there is no tab to operate on. */
const NO_TAB_MESSAGE =
	'Não há nenhuma aba ativa para executar esta ação. Abra ou selecione uma página primeiro.'

/** Normalize any thrown value into a readable string. */
function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

/**
 * Resolve the tab id to operate on. Prefers the controller's `currentTabId`
 * (set by the extension), falling back to the active tab of the focused window.
 */
async function resolveTabId(core: PageAgentCore): Promise<number | null> {
	const fromController = (core.pageController as any)?.currentTabId
	if (typeof fromController === 'number') return fromController
	const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
	return tab?.id ?? null
}

/**
 * Inject `func` into the target tab's ISOLATED world and return its result.
 * The function is serialized, so it cannot capture any outer scope — pass
 * everything it needs through `args`.
 */
async function runInPage<A extends unknown[], R>(
	tabId: number,
	func: (...args: A) => R,
	args: A
): Promise<R | undefined> {
	const results = await chrome.scripting.executeScript({
		target: { tabId },
		world: 'ISOLATED',
		func,
		args,
	})
	return (results?.[0]?.result ?? undefined) as R | undefined
}

/* -------------------------------------------------------------------------- */
/* In-page functions (self-contained; injected via chrome.scripting)          */
/* -------------------------------------------------------------------------- */

/** Find and click the best visible clickable whose label contains `text`. */
function pageClickText(text: string): { ok: boolean; label: string } {
	const needle = text.trim().toLowerCase()
	if (!needle) return { ok: false, label: '' }

	const selector =
		'a, button, [role="button"], input[type="submit"], input[type="button"], [onclick]'
	const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector))

	const labelOf = (el: HTMLElement): string => {
		const value = (el as HTMLInputElement).value
		const parts = [
			el.textContent || '',
			el.getAttribute('aria-label') || '',
			el.getAttribute('title') || '',
			typeof value === 'string' ? value : '',
		]
		return parts.join(' ').replace(/\s+/g, ' ').trim()
	}

	let best: { el: HTMLElement; label: string; score: number } | null = null
	for (const el of candidates) {
		if (el.offsetParent === null) continue
		const label = labelOf(el)
		const haystack = label.toLowerCase()
		if (!haystack.includes(needle)) continue
		let score = 1
		if (haystack === needle) score = 3
		else if (haystack.startsWith(needle)) score = 2
		if (!best || score > best.score) best = { el, label, score }
		if (score === 3) break
	}

	if (!best) return { ok: false, label: '' }
	best.el.scrollIntoView({ block: 'center' })
	best.el.click()
	return { ok: true, label: best.label.slice(0, 120) }
}

/** Find an input/textarea by its label-ish text and set its value (React-safe). */
function pageFillField(label: string, value: string): { ok: boolean; label: string } {
	const needle = label.trim().toLowerCase()
	if (!needle) return { ok: false, label: '' }

	const fields = Array.from(
		document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
	).filter((el) => {
		if (el instanceof HTMLInputElement && ['hidden', 'submit', 'button', 'reset'].includes(el.type))
			return false
		if (el.disabled) return false
		return el.offsetParent !== null
	})

	const labelsOf = (el: HTMLInputElement | HTMLTextAreaElement): string[] => {
		const out: string[] = []
		const associated = el.labels
		if (associated) for (const l of Array.from(associated)) out.push(l.textContent || '')
		const wrapping = el.closest('label')
		if (wrapping) out.push(wrapping.textContent || '')
		out.push(el.getAttribute('aria-label') || '')
		const labelledby = el.getAttribute('aria-labelledby')
		if (labelledby) {
			for (const id of labelledby.split(/\s+/)) {
				const ref = document.getElementById(id)
				if (ref) out.push(ref.textContent || '')
			}
		}
		out.push(el.getAttribute('placeholder') || '')
		out.push(el.getAttribute('name') || '')
		const prev = el.previousElementSibling
		if (prev) out.push(prev.textContent || '')
		return out.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
	}

	let best: { el: HTMLInputElement | HTMLTextAreaElement; label: string; score: number } | null =
		null
	for (const el of fields) {
		for (const candidate of labelsOf(el)) {
			const haystack = candidate.toLowerCase()
			if (!haystack.includes(needle)) continue
			let score = 1
			if (haystack === needle) score = 3
			else if (haystack.startsWith(needle)) score = 2
			if (!best || score > best.score) best = { el, label: candidate, score }
			break
		}
		if (best && best.score === 3) break
	}

	if (!best) return { ok: false, label: '' }

	const target = best.el
	const proto =
		target instanceof HTMLTextAreaElement
			? window.HTMLTextAreaElement.prototype
			: window.HTMLInputElement.prototype
	const descriptor = Object.getOwnPropertyDescriptor(proto, 'value')
	if (descriptor && descriptor.set) descriptor.set.call(target, value)
	else target.value = value
	target.dispatchEvent(new Event('input', { bubbles: true }))
	target.dispatchEvent(new Event('change', { bubbles: true }))
	return { ok: true, label: best.label.slice(0, 120) }
}

/** Return the page's visible text. */
function pageReadText(): string {
	return document.body ? document.body.innerText : ''
}

/** Whether `query` appears in the page; optionally scroll the match into view. */
function pageFindText(query: string, doScroll: boolean): boolean {
	const needle = query.trim().toLowerCase()
	if (!needle || !document.body) return false
	const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
	let node = walker.nextNode()
	while (node) {
		const nodeValue = node.nodeValue || ''
		if (nodeValue.toLowerCase().includes(needle)) {
			const parent = node.parentElement
			if (parent && doScroll) parent.scrollIntoView({ block: 'center' })
			return true
		}
		node = walker.nextNode()
	}
	return false
}

/** Click the first accept/close button inside a cookie/consent banner or modal. */
function pageDismissOverlays(): { ok: boolean; label: string } {
	const pattern = /aceitar|accept|concordo|ok|got it|entendi|fechar|close|×|dismiss/i
	const containers = new Set<HTMLElement>()

	const selector =
		'[role="dialog"], [class*="cookie" i], [class*="consent" i], [id*="cookie" i], [class*="overlay" i], [class*="modal" i], [class*="banner" i]'
	for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) containers.add(el)

	// Fixed/sticky overlays don't have an offsetParent, so detect them by computed style + size.
	for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
		const style = getComputedStyle(el)
		if (style.position !== 'fixed' && style.position !== 'sticky') continue
		if (style.display === 'none' || style.visibility === 'hidden') continue
		const rect = el.getBoundingClientRect()
		if (rect.width > 200 && rect.height > 60) containers.add(el)
	}

	const isShown = (el: HTMLElement): boolean => {
		const style = getComputedStyle(el)
		if (style.display === 'none' || style.visibility === 'hidden') return false
		const rect = el.getBoundingClientRect()
		return rect.width > 0 && rect.height > 0
	}

	const clickableSelector = 'button, a, [role="button"], input[type="button"], input[type="submit"]'
	for (const container of containers) {
		for (const el of Array.from(container.querySelectorAll<HTMLElement>(clickableSelector))) {
			const value = (el as HTMLInputElement).value
			const text = [
				el.textContent || '',
				el.getAttribute('aria-label') || '',
				typeof value === 'string' ? value : '',
			]
				.join(' ')
				.replace(/\s+/g, ' ')
				.trim()
			if (!text || !pattern.test(text) || !isShown(el)) continue
			el.click()
			return { ok: true, label: text.slice(0, 80) }
		}
	}
	return { ok: false, label: '' }
}

/** Return up to ~40 visible links/buttons as a navigation map. */
function pageListActions(): string[] {
	const selector = 'a, button, [role="button"], input[type="submit"], input[type="button"]'
	const out: string[] = []
	const seen = new Set<string>()
	for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
		if (el.offsetParent === null) continue
		const value = (el as HTMLInputElement).value
		const text = (
			el.textContent ||
			el.getAttribute('aria-label') ||
			el.getAttribute('title') ||
			(typeof value === 'string' ? value : '') ||
			''
		)
			.replace(/\s+/g, ' ')
			.trim()
		if (!text) continue
		const line = `[${text.slice(0, 60)}] (${el.tagName.toLowerCase()})`
		if (seen.has(line)) continue
		seen.add(line)
		out.push(line)
		if (out.length >= 40) break
	}
	return out
}

/** Return the page title, URL, and first h1/h2 heading. */
function pageInfo(): { title: string; url: string; heading: string } {
	const heading = document.querySelector('h1, h2')
	return {
		title: document.title || '',
		url: location.href,
		heading: heading ? (heading.textContent || '').replace(/\s+/g, ' ').trim() : '',
	}
}

/**
 * Scroll the page (or its largest scrollable region) up/down. Returns how far it
 * actually moved plus whether it reached an edge, so the tool can report honestly
 * ("já está no fim") instead of silently doing nothing.
 */
function pageScroll(
	direction: 'down' | 'up',
	amount: 'page' | 'half' | 'bottom' | 'top'
): { moved: number; atBottom: boolean; atTop: boolean } {
	const goingDown = direction !== 'up'

	// Prefer the document scroller; fall back to the largest element that can
	// actually scroll vertically (single-page apps often scroll an inner panel).
	const pickScroller = (): HTMLElement => {
		const doc = (document.scrollingElement || document.documentElement) as HTMLElement
		if (doc && doc.scrollHeight > doc.clientHeight + 4) return doc
		let best: HTMLElement | null = null
		let bestArea = 0
		for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
			const overflowY = getComputedStyle(el).overflowY
			if (overflowY !== 'auto' && overflowY !== 'scroll' && overflowY !== 'overlay') continue
			if (el.scrollHeight <= el.clientHeight + 4) continue
			const rect = el.getBoundingClientRect()
			const area = rect.width * rect.height
			if (area > bestArea) {
				best = el
				bestArea = area
			}
		}
		return best || doc
	}

	const scroller = pickScroller()
	const viewport = scroller.clientHeight || window.innerHeight || 800
	const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
	const before = scroller.scrollTop

	let target: number
	if (amount === 'bottom') target = maxTop
	else if (amount === 'top') target = 0
	else {
		const fraction = amount === 'half' ? 0.5 : 0.9
		target = before + viewport * fraction * (goingDown ? 1 : -1)
	}
	scroller.scrollTop = Math.max(0, Math.min(target, maxTop))

	const after = scroller.scrollTop
	return {
		moved: Math.round(after - before),
		atBottom: after >= maxTop - 2,
		atTop: after <= 2,
	}
}

/* -------------------------------------------------------------------------- */
/* Tool registry                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Create the helper toolbelt. The orchestrator wires the returned record into
 * `PageAgentCore` via `customTools`.
 */
export function createHelperTools(): Record<string, PageAgentTool> {
	return {
		click_text: tool({
			description:
				'Click the best matching visible link, button, or clickable element whose visible text, aria-label, title, or value contains the given text (case-insensitive; exact match preferred). Prefer this over guessing element indexes. Example: { "text": "Entrar" } clicks the login button.',
			inputSchema: z.object({
				text: z.string().describe('Visible text of the element to click, e.g. "Entrar"'),
			}),
			execute: async function (this: PageAgentCore, args, ctx) {
				try {
					ctx.signal.throwIfAborted()
					const tabId = await resolveTabId(this)
					if (tabId == null) return NO_TAB_MESSAGE
					const res = await runInPage(tabId, pageClickText, [args.text])
					if (!res || !res.ok)
						return `Não encontrei nenhum elemento clicável contendo "${args.text}".`
					return `Cliquei em "${res.label}".`
				} catch (error) {
					return `Erro ao tentar clicar em "${args.text}": ${errorMessage(error)}`
				}
			},
		}),

		fill_field: tool({
			description:
				'Fill a form input or textarea identified by its label text (matched against the associated <label>, wrapping label, aria-label, placeholder, name, or nearby text). Sets the value the way a real user would so React/Vue forms update. Example: { "label": "E-mail", "value": "ana@exemplo.com" }.',
			inputSchema: z.object({
				label: z.string().describe('The field label or placeholder, e.g. "E-mail"'),
				value: z.string().describe('The text to type into the field'),
			}),
			execute: async function (this: PageAgentCore, args, ctx) {
				try {
					ctx.signal.throwIfAborted()
					const tabId = await resolveTabId(this)
					if (tabId == null) return NO_TAB_MESSAGE
					const res = await runInPage(tabId, pageFillField, [args.label, args.value])
					if (!res || !res.ok) return `Não encontrei nenhum campo correspondente a "${args.label}".`
					return `Preenchi o campo "${res.label}" com "${args.value}".`
				} catch (error) {
					return `Erro ao preencher o campo "${args.label}": ${errorMessage(error)}`
				}
			},
		}),

		read_page_text: tool({
			description:
				'Read and return the visible text of the current page (cleaned and truncated to ~6000 characters). Use this to understand what is on the page before deciding what to do.',
			inputSchema: z.object({}),
			execute: async function (this: PageAgentCore, _args, ctx) {
				try {
					ctx.signal.throwIfAborted()
					const tabId = await resolveTabId(this)
					if (tabId == null) return NO_TAB_MESSAGE
					const raw = (await runInPage(tabId, pageReadText, [])) ?? ''
					const cleaned = raw
						.replace(/[ \t]+\n/g, '\n')
						.replace(/\n{3,}/g, '\n\n')
						.trim()
					if (!cleaned) return 'A página não contém texto legível.'
					const limit = 6000
					if (cleaned.length > limit)
						return `${cleaned.slice(0, limit)}\n\n[...texto truncado em ${limit} caracteres]`
					return cleaned
				} catch (error) {
					return `Erro ao ler a página: ${errorMessage(error)}`
				}
			},
		}),

		find_text: tool({
			description:
				'Check whether the given text appears anywhere on the current page. If found, scrolls it into view. Returns found/not-found.',
			inputSchema: z.object({
				query: z.string().describe('Text to look for on the page'),
			}),
			execute: async function (this: PageAgentCore, args, ctx) {
				try {
					ctx.signal.throwIfAborted()
					const tabId = await resolveTabId(this)
					if (tabId == null) return NO_TAB_MESSAGE
					const found = await runInPage(tabId, pageFindText, [args.query, true])
					return found
						? `Encontrei o texto "${args.query}" na página.`
						: `Não encontrei o texto "${args.query}" na página.`
				} catch (error) {
					return `Erro ao procurar o texto "${args.query}": ${errorMessage(error)}`
				}
			},
		}),

		scroll_page: tool({
			description:
				'Scroll the page to reveal content that is off-screen. Use this whenever the page continues below (or above) what is currently visible — e.g. to read more of an article or see more search results. direction: "down" (default) or "up". amount: "page" (default, ~90% of the screen), "half", "bottom" (jump to the very end of the page), or "top" (jump to the very start).',
			inputSchema: z.object({
				direction: z.enum(['down', 'up']).optional().default('down'),
				amount: z.enum(['page', 'half', 'bottom', 'top']).optional().default('page'),
			}),
			execute: async function (this: PageAgentCore, args, ctx) {
				try {
					ctx.signal.throwIfAborted()
					const tabId = await resolveTabId(this)
					if (tabId == null) return NO_TAB_MESSAGE
					const res = await runInPage(tabId, pageScroll, [args.direction, args.amount])
					if (!res) return 'Não consegui rolar a página.'
					if (res.moved === 0) {
						if (args.direction === 'up' || args.amount === 'top')
							return res.atTop
								? 'A página já está no topo, não dá para rolar mais para cima.'
								: 'Não consegui rolar a página para cima.'
						return res.atBottom
							? 'A página já está no fim, não dá para rolar mais para baixo.'
							: 'Não consegui rolar a página para baixo.'
					}
					const dir = res.moved > 0 ? 'para baixo' : 'para cima'
					let message = `Rolei a página ${dir} ${Math.abs(res.moved)} pixels.`
					if (res.atBottom) message += ' Cheguei ao fim da página.'
					else if (res.atTop) message += ' Cheguei ao topo da página.'
					return message
				} catch (error) {
					return `Erro ao rolar a página: ${errorMessage(error)}`
				}
			},
		}),

		dismiss_overlays: tool({
			description:
				'Try to close the first visible cookie banner, consent notice, or modal dialog by clicking its accept/close/dismiss button. Conservative: clicks at most one element. Use when a popup is blocking the page.',
			inputSchema: z.object({}),
			execute: async function (this: PageAgentCore, _args, ctx) {
				try {
					ctx.signal.throwIfAborted()
					const tabId = await resolveTabId(this)
					if (tabId == null) return NO_TAB_MESSAGE
					const res = await runInPage(tabId, pageDismissOverlays, [])
					if (!res || !res.ok) return 'Nenhum banner ou pop-up para fechar foi encontrado.'
					return `Fechei um pop-up clicando em "${res.label}".`
				} catch (error) {
					return `Erro ao tentar fechar pop-ups: ${errorMessage(error)}`
				}
			},
		}),

		list_actions: tool({
			description:
				'List up to ~40 visible links and buttons on the page as "[text] (tag)" lines — a quick map of what can be clicked. Use this to discover available navigation when unsure what to do next.',
			inputSchema: z.object({}),
			execute: async function (this: PageAgentCore, _args, ctx) {
				try {
					ctx.signal.throwIfAborted()
					const tabId = await resolveTabId(this)
					if (tabId == null) return NO_TAB_MESSAGE
					const actions = (await runInPage(tabId, pageListActions, [])) ?? []
					if (actions.length === 0) return 'Não encontrei links ou botões visíveis na página.'
					return `Ações disponíveis na página:\n${actions.join('\n')}`
				} catch (error) {
					return `Erro ao listar as ações da página: ${errorMessage(error)}`
				}
			},
		}),

		page_info: tool({
			description:
				'Return the current page title, URL, and first heading (h1/h2). Use this to confirm which page you are on.',
			inputSchema: z.object({}),
			execute: async function (this: PageAgentCore, _args, ctx) {
				try {
					ctx.signal.throwIfAborted()
					const tabId = await resolveTabId(this)
					if (tabId == null) return NO_TAB_MESSAGE
					const info = await runInPage(tabId, pageInfo, [])
					if (!info) return 'Não foi possível obter informações da página.'
					const lines = [`Título: ${info.title || '(sem título)'}`, `URL: ${info.url}`]
					if (info.heading) lines.push(`Cabeçalho: ${info.heading}`)
					return lines.join('\n')
				} catch (error) {
					return `Erro ao obter informações da página: ${errorMessage(error)}`
				}
			},
		}),

		go_back: tool({
			description:
				"Go back to the previous page in this tab's history (the browser Back button). Use THIS to go back — never run JavaScript like history.back(), which is blocked on many sites.",
			inputSchema: z.object({}),
			execute: async function (this: PageAgentCore, _args, ctx) {
				try {
					ctx.signal.throwIfAborted()
					const tabId = await resolveTabId(this)
					if (tabId == null) return NO_TAB_MESSAGE
					await chrome.tabs.goBack(tabId)
					return 'Voltei para a página anterior.'
				} catch (error) {
					return `Não consegui voltar para a página anterior: ${errorMessage(error)}`
				}
			},
		}),

		go_forward: tool({
			description:
				"Go forward to the next page in this tab's history (the browser Forward button).",
			inputSchema: z.object({}),
			execute: async function (this: PageAgentCore, _args, ctx) {
				try {
					ctx.signal.throwIfAborted()
					const tabId = await resolveTabId(this)
					if (tabId == null) return NO_TAB_MESSAGE
					await chrome.tabs.goForward(tabId)
					return 'Avancei para a próxima página.'
				} catch (error) {
					return `Não consegui avançar: ${errorMessage(error)}`
				}
			},
		}),

		reload_page: tool({
			description: 'Reload (refresh) the current page.',
			inputSchema: z.object({}),
			execute: async function (this: PageAgentCore, _args, ctx) {
				try {
					ctx.signal.throwIfAborted()
					const tabId = await resolveTabId(this)
					if (tabId == null) return NO_TAB_MESSAGE
					await chrome.tabs.reload(tabId)
					return 'Recarreguei a página.'
				} catch (error) {
					return `Não consegui recarregar a página: ${errorMessage(error)}`
				}
			},
		}),

		go_to_url: tool({
			description:
				'Navigate the current tab to a URL (the address bar). Use THIS to open a website — never run JavaScript to change location. Example: { "url": "google.com" }.',
			inputSchema: z.object({
				url: z.string().describe('The address to open, e.g. "google.com" or "https://gmail.com"'),
			}),
			execute: async function (this: PageAgentCore, args, ctx) {
				try {
					ctx.signal.throwIfAborted()
					const tabId = await resolveTabId(this)
					if (tabId == null) return NO_TAB_MESSAGE
					const url = /^[a-z]+:\/\//i.test(args.url) ? args.url : `https://${args.url}`
					await chrome.tabs.update(tabId, { url })
					return `Abrindo ${url}.`
				} catch (error) {
					return `Não consegui abrir "${args.url}": ${errorMessage(error)}`
				}
			},
		}),

		wait_for_text: tool({
			description:
				'Wait until the given text appears anywhere on the page, polling for up to `seconds` seconds (default 8, max 30). Use after an action that loads content asynchronously. Returns as soon as the text is found, or a timeout message.',
			inputSchema: z.object({
				text: z.string().describe('Text to wait for, e.g. "Pagamento confirmado"'),
				seconds: z
					.number()
					.min(1)
					.max(30)
					.optional()
					.default(8)
					.describe('How many seconds to keep polling (default 8, max 30)'),
			}),
			execute: async function (this: PageAgentCore, args, ctx) {
				try {
					const tabId = await resolveTabId(this)
					if (tabId == null) return NO_TAB_MESSAGE
					const seconds = Math.min(args.seconds, 30)
					const deadline = Date.now() + seconds * 1000
					while (Date.now() < deadline) {
						ctx.signal.throwIfAborted()
						const found = await runInPage(tabId, pageFindText, [args.text, true])
						if (found) return `O texto "${args.text}" apareceu na página.`
						await new Promise((resolve) => setTimeout(resolve, 500))
					}
					return `O texto "${args.text}" não apareceu após ${seconds} segundos.`
				} catch (error) {
					return `Erro ao aguardar o texto "${args.text}": ${errorMessage(error)}`
				}
			},
		}),
	}
}
