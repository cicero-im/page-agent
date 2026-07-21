import type React from "react";
import { useEffect, useRef, useState } from "react";

/**
 * Walks up the DOM from `el` to find the first ancestor with
 * a non-transparent computed backgroundColor. Returns [r, g, b].
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
function contrastRatio(l1: number, l2: number): number {
	const lighter = Math.max(l1, l2);
	const darker = Math.min(l1, l2);
	return (lighter + 0.05) / (darker + 0.05);
}

const WHITE_LUMINANCE = relativeLuminance(255, 255, 255);
const BLACK_LUMINANCE = relativeLuminance(0, 0, 0);

export type ContrastResult = {
	/** Optimal foreground color for WCAG contrast ("#000000" or "#ffffff") */
	color: string;
	/** The achieved WCAG contrast ratio */
	ratio: number;
	/** Ref to attach — only used when no externalRef is provided */
	ref: React.RefObject<HTMLElement | null>;
};

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
	deps: unknown[] = [],
): ContrastResult {
	const internalRef = useRef<HTMLElement | null>(null);
	const activeRef = externalRef ?? internalRef;

	const [result, setResult] = useState<{ color: string; ratio: number }>({
		color: "#000000",
		ratio: 21,
	});

	useEffect(() => {
		const el = activeRef.current;
		if (!el) return;

		function update() {
			const target = activeRef.current;
			if (!target) return;

			const [r, g, b] = getEffectiveBackgroundColor(target);
			const bgLum = relativeLuminance(r, g, b);

			const whiteContrast = contrastRatio(bgLum, WHITE_LUMINANCE);
			const blackContrast = contrastRatio(bgLum, BLACK_LUMINANCE);

			const best =
				whiteContrast >= blackContrast
					? { color: "#ffffff", ratio: whiteContrast }
					: { color: "#000000", ratio: blackContrast };

			setResult((prev) => (prev.color === best.color ? prev : best));
		}

		update();

		const mo = new MutationObserver(update);
		mo.observe(el, { attributes: true, attributeFilter: ["class", "style"] });
		if (document.documentElement) {
			mo.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ["class", "style", "data-theme"],
			});
		}

		const ro = new ResizeObserver(update);
		ro.observe(el);

		return () => {
			mo.disconnect();
			ro.disconnect();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- deps is caller-controlled
	}, [activeRef, ...deps]);

	return { ...result, ref: internalRef };
}
