import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		name: 'mcp',
		include: ['src/**/*.test.js'],
		// Suppress console output from passing tests; failed tests still get their logs.
		silent: 'passed-only',
	},
})
