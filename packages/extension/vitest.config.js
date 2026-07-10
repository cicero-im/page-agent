import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	// Mirror the WXT `@/` → `src/` alias so tests can import modules the same way
	// the extension code does.
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
	test: {
		name: 'ext',
		include: ['src/**/*.test.ts'],
		// Suppress console output from passing tests; failed tests still get their logs.
		silent: 'passed-only',
	},
})
