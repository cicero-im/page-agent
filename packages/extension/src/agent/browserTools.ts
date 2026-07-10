/**
 * Browser-capability toolbelt for the Cícero extension.
 *
 * Unlike `helperTools.ts` (which manipulates the *page* DOM via injected
 * functions), these tools drive Chrome itself through the privileged extension
 * APIs (`chrome.downloads`, `chrome.bookmarks`, `chrome.history`, …). They run in
 * the side-panel context, where those APIs are available.
 *
 * They exist so the small model can do genuinely useful real-life chores for a
 * user who cannot use her hands: download a file, save/return to a site, get an
 * out-loud system notification when something finishes, copy/paste by voice, etc.
 *
 * Every tool:
 *  - returns a short, friendly pt-BR string (never a raw error),
 *  - honors `ctx.signal` (cooperative cancellation),
 *  - degrades gracefully when an API is unavailable instead of throwing.
 */
import { type PageAgentCore, type PageAgentTool, tool } from '@page-agent/core'
import * as z from 'zod/v4'

/** Normalize any thrown value into a readable string. */
function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

/** The current tab id the agent is operating on, if any. */
async function resolveTabId(core: PageAgentCore): Promise<number | null> {
	const fromController = (core.pageController as any)?.currentTabId
	if (typeof fromController === 'number') return fromController
	const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
	return tab?.id ?? null
}

/** Resolve the current tab (for defaulting url/title), or null. */
async function resolveCurrentTab(core: PageAgentCore): Promise<chrome.tabs.Tab | null> {
	try {
		const tabId = await resolveTabId(core)
		if (tabId == null) return null
		return await chrome.tabs.get(tabId)
	} catch {
		return null
	}
}

/** Prefix a bare host/path with https:// so chrome APIs accept it. */
function normalizeUrl(url: string): string {
	return /^[a-z]+:\/\//i.test(url) ? url : `https://${url}`
}

/**
 * Create the browser-capability toolbelt. Wired into `PageAgentCore` via
 * `customTools` alongside the page/tab tools.
 */
export function createBrowserTools(): Record<string, PageAgentTool> {
	return {
		download_file: tool({
			description:
				'Download a file from a direct URL to the computer (no dialog — it goes to the Downloads folder). Use for "baixe este arquivo/foto/PDF". Example: { "url": "https://site.com/contrato.pdf" }.',
			inputSchema: z.object({
				url: z.string().describe('Direct URL of the file to download'),
				filename: z
					.string()
					.optional()
					.describe('Optional name to save the file as, e.g. "contrato.pdf"'),
			}),
			execute: async function (this: PageAgentCore, args, ctx) {
				try {
					ctx.signal.throwIfAborted()
					if (typeof chrome === 'undefined' || !chrome.downloads) {
						return 'O download não está disponível neste contexto.'
					}
					const url = normalizeUrl(args.url)
					const id = await chrome.downloads.download({
						url,
						filename: args.filename,
						saveAs: false,
					})
					if (typeof id !== 'number') return `Não consegui iniciar o download de "${url}".`
					return `Comecei a baixar ${args.filename ? `"${args.filename}"` : 'o arquivo'}. Ele vai para a pasta de Downloads.`
				} catch (error) {
					return `Não consegui baixar o arquivo: ${errorMessage(error)}`
				}
			},
		}),

		save_bookmark: tool({
			description:
				'Save (bookmark) a page so it is easy to find later. If no URL is given, bookmarks the page currently open. Example: { "title": "Folha de S.Paulo" }.',
			inputSchema: z.object({
				url: z.string().optional().describe('URL to bookmark; defaults to the current page'),
				title: z.string().optional().describe('Name for the bookmark; defaults to the page title'),
			}),
			execute: async function (this: PageAgentCore, args, ctx) {
				try {
					ctx.signal.throwIfAborted()
					if (typeof chrome === 'undefined' || !chrome.bookmarks) {
						return 'Os favoritos não estão disponíveis neste contexto.'
					}
					const current = args.url ? null : await resolveCurrentTab(this)
					const url = args.url ? normalizeUrl(args.url) : current?.url
					const title = args.title || current?.title || url
					if (!url) return 'Não há nenhuma página para salvar nos favoritos.'
					await chrome.bookmarks.create({ title, url })
					return `Salvei "${title}" nos favoritos.`
				} catch (error) {
					return `Não consegui salvar nos favoritos: ${errorMessage(error)}`
				}
			},
		}),

		add_to_reading_list: tool({
			description:
				'Add a page to the Chrome reading list to read later. If no URL is given, uses the page currently open.',
			inputSchema: z.object({
				url: z.string().optional().describe('URL to add; defaults to the current page'),
				title: z.string().optional().describe('Title; defaults to the page title'),
			}),
			execute: async function (this: PageAgentCore, args, ctx) {
				try {
					ctx.signal.throwIfAborted()
					if (typeof chrome === 'undefined' || !chrome.readingList) {
						return 'A lista de leitura não está disponível neste contexto.'
					}
					const current = args.url ? null : await resolveCurrentTab(this)
					const url = args.url ? normalizeUrl(args.url) : current?.url
					const title = args.title || current?.title || url
					if (!url) return 'Não há nenhuma página para adicionar à lista de leitura.'
					await chrome.readingList.addEntry({ url, title: title!, hasBeenRead: false })
					return `Adicionei "${title}" à lista de leitura.`
				} catch (error) {
					return `Não consegui adicionar à lista de leitura: ${errorMessage(error)}`
				}
			},
		}),

		recent_sites: tool({
			description:
				'List the sites recently visited (most recent first), as "Título — url" lines. Use to answer "que sites eu vi antes?" or to find a page to go back to.',
			inputSchema: z.object({
				query: z
					.string()
					.optional()
					.describe('Optional words to filter the history by, e.g. "folha"'),
			}),
			execute: async function (this: PageAgentCore, args, ctx) {
				try {
					ctx.signal.throwIfAborted()
					if (typeof chrome === 'undefined' || !chrome.history) {
						return 'O histórico não está disponível neste contexto.'
					}
					const items = await chrome.history.search({
						text: args.query ?? '',
						maxResults: 15,
						startTime: 0,
					})
					if (!items.length) return 'Não encontrei sites recentes no histórico.'
					const lines = items
						.filter((it) => it.url)
						.map((it) => `${(it.title || it.url || '').slice(0, 70)} — ${it.url}`)
					return `Sites recentes:\n${lines.join('\n')}`
				} catch (error) {
					return `Não consegui ler o histórico: ${errorMessage(error)}`
				}
			},
		}),

		open_recent: tool({
			description:
				'Find a recently visited site by some words and open it in the current tab. Perfect for "volta pro site de antes" / "abre de novo aquele site da folha". Example: { "query": "folha" }.',
			inputSchema: z.object({
				query: z.string().describe('Words that identify the site, e.g. "folha" or "gmail"'),
			}),
			execute: async function (this: PageAgentCore, args, ctx) {
				try {
					ctx.signal.throwIfAborted()
					if (typeof chrome === 'undefined' || !chrome.history) {
						return 'O histórico não está disponível neste contexto.'
					}
					const items = await chrome.history.search({
						text: args.query,
						maxResults: 1,
						startTime: 0,
					})
					const target = items.find((it) => it.url)
					if (!target?.url) return `Não encontrei nenhum site recente com "${args.query}".`
					const tabId = await resolveTabId(this)
					if (tabId == null) {
						await chrome.tabs.create({ url: target.url, active: true })
					} else {
						await chrome.tabs.update(tabId, { url: target.url, active: true })
					}
					return `Abrindo "${target.title || target.url}".`
				} catch (error) {
					return `Não consegui abrir o site recente: ${errorMessage(error)}`
				}
			},
		}),

		top_sites: tool({
			description:
				'List the most visited sites (the ones that show on the new-tab page), as "Título — url" lines. Use for "abre um dos meus sites preferidos".',
			inputSchema: z.object({}),
			execute: async function (this: PageAgentCore, _args, ctx) {
				try {
					ctx.signal.throwIfAborted()
					if (typeof chrome === 'undefined' || !chrome.topSites) {
						return 'Os sites mais visitados não estão disponíveis neste contexto.'
					}
					const items = await chrome.topSites.get()
					if (!items.length) return 'Não encontrei sites mais visitados.'
					const lines = items
						.slice(0, 12)
						.map((it) => `${(it.title || it.url).slice(0, 70)} — ${it.url}`)
					return `Sites mais visitados:\n${lines.join('\n')}`
				} catch (error) {
					return `Não consegui obter os sites mais visitados: ${errorMessage(error)}`
				}
			},
		}),

		notify: tool({
			description:
				'Show a system notification (with the operating system\'s sound) to get her attention — use it when a task is finished or when you need her to look at the screen to confirm something. Example: { "message": "Terminei de preencher o formulário." }.',
			inputSchema: z.object({
				message: z.string().describe('The message to show'),
				title: z.string().optional().describe('Optional title; defaults to "Cícero"'),
			}),
			execute: async function (this: PageAgentCore, args, ctx) {
				try {
					ctx.signal.throwIfAborted()
					if (typeof chrome === 'undefined' || !chrome.notifications) {
						return 'As notificações não estão disponíveis neste contexto.'
					}
					await chrome.notifications.create({
						type: 'basic',
						// Uses the shipped icon until the Cicero brand assets land (F5).
						iconUrl: chrome.runtime.getURL('assets/page-agent-64.png'),
						title: args.title || 'Cícero',
						message: args.message,
						priority: 2,
					})
					return `Avisei ela: "${args.message}".`
				} catch (error) {
					return `Não consegui mostrar a notificação: ${errorMessage(error)}`
				}
			},
		}),

		copy_text: tool({
			description:
				'Copy some text to the clipboard so she can paste it elsewhere. Example: { "text": "Rua das Flores, 123" }.',
			inputSchema: z.object({
				text: z.string().describe('The text to put on the clipboard'),
			}),
			execute: async function (this: PageAgentCore, args, ctx) {
				try {
					ctx.signal.throwIfAborted()
					await navigator.clipboard.writeText(args.text)
					return 'Copiei o texto para a área de transferência.'
				} catch (error) {
					return `Não consegui copiar o texto: ${errorMessage(error)}`
				}
			},
		}),

		read_clipboard: tool({
			description:
				'Read the text currently on the clipboard (what was last copied). Use when she says "cola o que eu copiei" / "usa o que está copiado".',
			inputSchema: z.object({}),
			execute: async function (this: PageAgentCore, _args, ctx) {
				try {
					ctx.signal.throwIfAborted()
					const text = await navigator.clipboard.readText()
					if (!text) return 'A área de transferência está vazia.'
					return `Texto copiado:\n${text.slice(0, 4000)}`
				} catch (error) {
					return `Não consegui ler a área de transferência: ${errorMessage(error)}`
				}
			},
		}),
	}
}
