import tailwindcss from '@tailwindcss/vite'
import { mkdirSync, readFileSync } from 'node:fs'
import { defineConfig } from 'wxt'

const chromeProfile = '.wxt/chrome-data'
mkdirSync(chromeProfile, { recursive: true })

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

// See https://wxt.dev/api/config.html
export default defineConfig({
	srcDir: 'src',
	modules: ['@wxt-dev/module-react'],
	webExt: {
		chromiumProfile: chromeProfile,
		keepProfileChanges: true,
		chromiumArgs: ['--hide-crash-restore-bubble'],
	},
	vite: () => ({
		plugins: [tailwindcss()],
		define: {
			__VERSION__: JSON.stringify(pkg.version),
		},
		optimizeDeps: {
			force: true,
		},
		build: {
			minify: false,
			chunkSizeWarningLimit: 2000,
			cssCodeSplit: true,
			rollupOptions: {
				onwarn: function (message, handler) {
					if (message.code === 'EVAL') return
					handler(message)
				},
			},
		},
	}),
	zip: {
		artifactTemplate: 'cicero-agent-{{version}}-{{browser}}.zip',
	},
	manifest: {
		key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqbzT0iTYeYlnCvDJIGDnGU8oarJgZILDzSfLi/ufuSxXEPDKuMyD892GhvrMCZNVHS11Sh6NYUOc/PcUOhtaR2urHtcNkrpSJNV10zUamY7fxBdVEkOucfyLu8INVy+teis62MoRWYPaUPkfZUjrLGW8MsZ9aFzARfu9GGDEp2EAYsWDN6w6vyz9LJ82pm542EWnVT4MjmDPgvYFCWGBtaU/dfHD+GAX6URJFapsCvryVURKJ+76c/GO9/I3EX1IBfbY6dec78bLCMvVxiTmiv36KyGPwX1OpakW8IiCpXWdbAxjm+plbYlp5t5zTyyoE3sOSFeXsBH0Kg27o8GcvQIDAQAB',
		default_locale: 'pt_BR',
		name: '__MSG_extName__',
		description: '__MSG_extDescription__',
		homepage_url: 'https://cicero.im',
		// Full capability set for Cícero: core + every "useful" and "niche" API.
		// Wired into agent tools today: downloads(+open), bookmarks, readingList,
		//   history, topSites, notifications, clipboardRead/Write, scripting, tabs.
		// Declared for breadth / near-term tools: alarms, background, browsingData,
		//   contentSettings, debugger, desktopCapture, favicon, idle, offscreen,
		//   pageCapture, search, tabCapture, tts, ttsEngine, webNavigation.
		// Core: tabs, tabGroups, sidePanel, storage, scripting (+ <all_urls>).
		// Excluded on purpose: nativeMessaging (per request) and getDisplayMedia
		//   (a runtime web API, not a manifest permission). The microphone is also
		//   NOT a manifest permission — getUserMedia prompts her once at runtime.
		permissions: [
			'activeTab',
			'alarms',
			'background',
			'bookmarks',
			'browsingData',
			'clipboardRead',
			'clipboardWrite',
			'contentSettings',
			'debugger',
			'desktopCapture',
			'downloads',
			'downloads.open',
			'favicon',
			'history',
			'idle',
			'notifications',
			'offscreen',
			'pageCapture',
			'readingList',
			'scripting',
			'search',
			'sidePanel',
			'storage',
			'tabCapture',
			'tabGroups',
			'tabs',
			'topSites',
			'tts',
			'ttsEngine',
			'webNavigation',
		],
		host_permissions: ['<all_urls>'],
		// Global, Chrome-honored keyboard shortcuts — fire even when the side panel
		// is NOT focused. TWO keys max (she can't do 3-key chords): one modifier +
		// one letter. We use Alt because it's the one modifier whose 2-key combos
		// Chrome does NOT reserve (plain Cmd/Ctrl+L = address bar, Cmd/Ctrl+K =
		// omnibox are reserved). On Mac, Alt = Option. L/K are adjacent on the home
		// row. The primary flow is still simpler: speak → Enter (see the side panel).
		commands: {
			listen_mic: {
				suggested_key: { default: 'Alt+L', mac: 'Alt+L' },
				description: 'Cícero: ouvir / parar o microfone',
			},
			submit_now: {
				suggested_key: { default: 'Alt+K', mac: 'Alt+K' },
				description: 'Cícero: enviar o que foi falado ou digitado',
			},
		},
		icons: {
			16: 'assets/cicero-16.png',
			32: 'assets/cicero-32.png',
			48: 'assets/cicero-48.png',
			128: 'assets/cicero-128.png',
		},
		action: {
			default_title: '__MSG_extActionTitle__',
			default_icon: {
				16: 'assets/cicero-16.png',
				32: 'assets/cicero-32.png',
				48: 'assets/cicero-48.png',
				128: 'assets/cicero-128.png',
			},
		},
		web_accessible_resources: [
			{
				resources: ['main-world.js'],
				matches: ['*://*/*'],
			},
		],
		side_panel: {
			default_path: 'sidepanel/index.html',
		},
		externally_connectable: {
			matches: ['http://localhost/*'],
		},
	},
})
