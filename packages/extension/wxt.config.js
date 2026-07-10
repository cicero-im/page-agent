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
		artifactTemplate: 'page-agent-ext-{{version}}-{{browser}}.zip',
	},
	manifest: {
		key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqbzT0iTYeYlnCvDJIGDnGU8oarJgZILDzSfLi/ufuSxXEPDKuMyD892GhvrMCZNVHS11Sh6NYUOc/PcUOhtaR2urHtcNkrpSJNV10zUamY7fxBdVEkOucfyLu8INVy+teis62MoRWYPaUPkfZUjrLGW8MsZ9aFzARfu9GGDEp2EAYsWDN6w6vyz9LJ82pm542EWnVT4MjmDPgvYFCWGBtaU/dfHD+GAX6URJFapsCvryVURKJ+76c/GO9/I3EX1IBfbY6dec78bLCMvVxiTmiv36KyGPwX1OpakW8IiCpXWdbAxjm+plbYlp5t5zTyyoE3sOSFeXsBH0Kg27o8GcvQIDAQAB',
		default_locale: 'en',
		name: '__MSG_extName__',
		description: '__MSG_extDescription__',
		homepage_url: 'https://alibaba.github.io/page-agent/',
		// Core + permissions required by helperTools / browserTools / screenshots.
		// Broader kitchen-sink permissions from PR11 deferred until brand packaging (F7).
		permissions: [
			'tabs',
			'tabGroups',
			'sidePanel',
			'storage',
			'scripting',
			'downloads',
			'downloads.open',
			'bookmarks',
			'readingList',
			'history',
			'topSites',
			'notifications',
			'clipboardRead',
			'clipboardWrite',
			'activeTab',
		],
		host_permissions: ['<all_urls>'],
		// Global keyboard shortcuts for hands-free mic / submit (C7).
		// Side panel consumes `ciceroPendingCommand` from storage (wired in E/F).
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
			64: 'assets/page-agent-64.png',
		},
		action: {
			default_title: '__MSG_extActionTitle__',
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
