import type React from "react";
import { useEffect, useRef, useState } from "react";

/**
 * Parses a CSS color string (rgb/rgba) into [r, g, b] components.
 * Falls back to walking up the DOM for transparent backgrounds.
 */
function getEffectiveBackgroundColor(
	el: HTMLElement | null,
): [number, number, number] {
	let current = el;
	while (current) {
		const bg = getComputedStyle(current).backgroundColor;
		const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
		if (match) {
			const alpha = match[4] !== undefined ? parseFloat(match[4]) : 1;
			if (alpha > 0.01) {
				return [
					parseInt(match[1], 10),
					parseInt(match[2], 10),
					parseInt(match[3], 10),
				];
			}
		}
		current = current.parentElement;
	}
	// Default assumption: white background
	return [255, 255, 255];
}

/**
 * WCAG 2.1 relative luminance from sRGB.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function relativeLuminance(r: number, g: number, b: number): number {
	const sr = r / 255;
	const sg = g / 255;
	const sb = b / 255;
	const rs = sr <= 0.04045 ? sr / 12.92 : ((sr + 0.055) / 1.055) ** 2.4;
	const gs = sg <= 0.04045 ? sg / 12.92 : ((sg + 0.055) / 1.055) ** 2.4;
	const bs = sb <= 0.04045 ? sb / 12.92 : ((sb + 0.055) / 1.055) ** 2.4;
	return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * WCAG contrast ratio between two luminances.
 */
function contrastRatio(l1: number, l2: number): number {
	const lighter = Math.max(l1, l2);
	const darker = Math.min(l1, l2);
	return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastResult = {
	/** The color string to use as foreground (e.g. "#000000" or "#ffffff") */
	color: string;
	/** The WCAG contrast ratio achieved */
	ratio: number;
	/** The ref to attach to the SVG's parent (or the SVG itself) */
	ref: React.RefObject<HTMLElement | null>;
};

/**
 * Observes the effective background color of the referenced element
 * and returns the foreground color (black or white) with better WCAG contrast.
 *
 * Uses MutationObserver + ResizeObserver to react to DOM/style changes.
 */
export function useContrastColor(): ContrastResult {
	const ref = useRef<HTMLElement | null>(null);
	const [result, setResult] = useState<{ color: string; ratio: number }>({
		color: "#000000",
		ratio: 21,
	});

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		function update() {
			const [r, g, b] = getEffectiveBackgroundColor(ref.current);
			const bgLum = relativeLuminance(r, g, b);
			const whiteLum = relativeLuminance(255, 255, 255);
			const blackLum = relativeLuminance(0, 0, 0);

			const whiteContrast = contrastRatio(bgLum, whiteLum);
			const blackContrast = contrastRatio(bgLum, blackLum);

			const best =
				whiteContrast >= blackContrast
					? { color: "#ffffff", ratio: whiteContrast }
					: { color: "#000000", ratio: blackContrast };

			setResult((prev) => (prev.color === best.color ? prev : best));
		}

		update();

		// Re-check when the subtree or attributes change (covers class/style toggling)
		const mo = new MutationObserver(update);
		mo.observe(el, { attributes: true, attributeFilter: ["class", "style"] });
		// Also watch ancestors — dark mode toggles often flip a class on <html> or <body>
		if (document.documentElement) {
			mo.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ["class", "style", "data-theme"],
			});
		}

		// ResizeObserver as a cheap proxy for layout shifts that may change layered backgrounds
		const ro = new ResizeObserver(update);
		ro.observe(el);

		return () => {
			mo.disconnect();
			ro.disconnect();
		};
	}, []);

	return { ...result, ref };
}
