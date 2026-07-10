import type React from 'react'
import { useEffect, useRef, useState } from 'react'

/**
 * Walks up the DOM from `el` to find the first ancestor with
 * a non-transparent computed backgroundColor. Returns [r, g, b].
 *
 * Handles rgb(), rgba(), hsl(), hsla(), oklch(), and named colors.
 * Falls back to checking the `.dark` class on <html> for color-scheme
 * detection when the computed value uses an unparseable format.
 */
function parseColorToRgb(color: string): [number, number, number] | null {
	const RGB_RE = /rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/
	const HSL_RE = /hsla?\(([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%/
	const OKLCH_RE = /oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)/

	// rgb() / rgba()
	let m = RGB_RE.exec(color)
	if (m) return [+m[1], +m[2], +m[3]]

	// hsl() / hsla()
	m = HSL_RE.exec(color)
	if (m) return hslToRgb(+m[1], +m[2] / 100, +m[3] / 100)

	// oklch(L C H)
	m = OKLCH_RE.exec(color)
	if (m) return oklchToRgb(+m[1], +m[2], +m[3])

	return null
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
	h /= 360
	const hue = (p: number, q: number, t: number) => {
		if (t < 0) t += 1
		if (t > 1) t -= 1
		if (t < 1 / 6) return p + (q - p) * 6 * t
		if (t < 1 / 2) return q
		if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
		return p
	}
	let r: number, g: number, b: number
	if (s === 0) {
		r = g = b = l
	} else {
		const q = l < 0.5 ? l * (1 + s) : l + s - l * s
		const p = 2 * l - q
		r = hue(p, q, h + 1 / 3)
		g = hue(p, q, h)
		b = hue(p, q, h - 1 / 3)
	}
	return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

function oklchToRgb(L: number, C: number, H: number): [number, number, number] {
	// OKLCH → OKLab
	const hRad = (H * Math.PI) / 180
	const a = C * Math.cos(hRad)
	const b = C * Math.sin(hRad)

	// OKLab → LMS' (non-linear)
	const l_ = L + 0.3963377774 * a + 0.2158037573 * b
	const m_ = L - 0.1055613458 * a - 0.0638541728 * b
	const s_ = L - 0.0894841775 * a - 1.291485548 * b

	// Cube
	const lC = l_ ** 3
	const mC = m_ ** 3
	const sC = s_ ** 3

	// LMS'' → linear sRGB
	const rLin = 4.0767416621 * lC - 3.3077115913 * mC + 0.2309699292 * sC
	const gLin = -1.2684380046 * lC + 2.6097574011 * mC - 0.3413193965 * sC
	const bLin = -0.0041960863 * lC - 0.7034186147 * mC + 1.707614701 * sC

	// Linear sRGB → sRGB (gamma encoding)
	return [linearToSrgb(rLin), linearToSrgb(gLin), linearToSrgb(bLin)]
}

function linearToSrgb(c: number): number {
	const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
	return clamp255(v * 255)
}

function clamp255(v: number): number {
	return Math.max(0, Math.min(255, v))
}

function getEffectiveBackgroundColor(el: HTMLElement | null): [number, number, number] {
	let current = el
	while (current) {
		const bg = getComputedStyle(current).backgroundColor
		if (bg && bg !== 'transparent') {
			const rgb = parseColorToRgb(bg)
			if (rgb) return rgb
		}
		current = current.parentElement
	}
	// Fallback: if <html> has .dark class, assume dark background
	if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
		return [18, 18, 18]
	}
	return [255, 255, 255]
}

/**
 * WCAG 2.1 relative luminance from sRGB.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function relativeLuminance(r: number, g: number, b: number): number {
	const sr = r / 255
	const sg = g / 255
	const sb = b / 255
	const rs = sr <= 0.04045 ? sr / 12.92 : ((sr + 0.055) / 1.055) ** 2.4
	const gs = sg <= 0.04045 ? sg / 12.92 : ((sg + 0.055) / 1.055) ** 2.4
	const bs = sb <= 0.04045 ? sb / 12.92 : ((sb + 0.055) / 1.055) ** 2.4
	return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}
function contrastRatio(l1: number, l2: number): number {
	const lighter = Math.max(l1, l2)
	const darker = Math.min(l1, l2)
	return (lighter + 0.05) / (darker + 0.05)
}

const WHITE_LUMINANCE = relativeLuminance(255, 255, 255)
const BLACK_LUMINANCE = relativeLuminance(0, 0, 0)

export interface ContrastResult {
	/** Optimal foreground color for WCAG contrast ("#000000" or "#ffffff") */
	color: string
	/** The achieved WCAG contrast ratio */
	ratio: number
	/** Ref to attach — only used when no externalRef is provided */
	ref: React.RefObject<HTMLElement | null>
}

/**
 * Returns the foreground color (black or white) that maximizes WCAG contrast
 * against the effective background of the observed element.
 *
 * @param externalRef  Pass an existing ref to observe instead of attaching the
 *                     returned `ref`. Useful when the element already has a ref.
 * @param deps         Extra dependencies that should re-trigger the background
 *                     check. Pass values like `[isMounted]` when the observed
 *                     element is conditionally rendered so the effect re-runs
 *                     once the ref becomes populated.
 */
export function useContrastColor(
	externalRef?: React.RefObject<HTMLElement | null>,
	deps: unknown[] = []
): ContrastResult {
	const internalRef = useRef<HTMLElement | null>(null)
	const activeRef = externalRef ?? internalRef

	const [result, setResult] = useState<{ color: string; ratio: number }>({
		color: '#000000',
		ratio: 21,
	})

	useEffect(() => {
		const el = activeRef.current
		if (!el) return

		function update() {
			const target = activeRef.current
			if (!target) return

			const [r, g, b] = getEffectiveBackgroundColor(target)
			const bgLum = relativeLuminance(r, g, b)

			const whiteContrast = contrastRatio(bgLum, WHITE_LUMINANCE)
			const blackContrast = contrastRatio(bgLum, BLACK_LUMINANCE)

			const best =
				whiteContrast >= blackContrast
					? { color: '#ffffff', ratio: whiteContrast }
					: { color: '#000000', ratio: blackContrast }

			setResult((prev) => (prev.color === best.color ? prev : best))
		}

		update()

		const mo = new MutationObserver(update)
		mo.observe(el, { attributes: true, attributeFilter: ['class', 'style'] })
		if (document.documentElement) {
			mo.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ['class', 'style', 'data-theme'],
			})
		}

		const ro = new ResizeObserver(update)
		ro.observe(el)

		return () => {
			mo.disconnect()
			ro.disconnect()
		}
	}, [activeRef, ...deps])

	return { ...result, ref: internalRef }
}
