import type React from "react";
import { useContrastColor } from "./use-contrast-color";

type IconProps = React.SVGProps<SVGSVGElement>;

/**
 * Wraps any icon component so its color automatically contrasts
 * against whatever background it's rendered on.
 */
export function AdaptiveIcon({
	icon: Icon,
	...props
}: { icon: React.FC<IconProps> } & IconProps) {
	const { color, ref } = useContrastColor();

	return (
		<span ref={ref} style={{ display: "inline-flex", color }}>
			<Icon {...props} />
		</span>
	);
}

export const BracketLeftIcon: React.FC<IconProps> = (props) => (
	<svg
		fill="currentColor"
		viewBox="0 0 4096 4096"
		xmlns="http://www.w3.org/2000/svg"
		{...props}
	>
		<title>Left Bracket</title>
		<path d="m1739 1284.5-1 1h-26l-1 1h-8l-1 1h-14l-1 1h-7l-1 1h-12l-1 1h-5l-1 1h-8l-1 1h-4l-1 1h-7l-1 1h-3l-1 1h-7l-1 1h-3l-1 1h-6l-1 1h-2l-1 1h-5l-1 1h-3l-1 1h-4l-1 1h-2l-1 1h-4l-1 1h-3l-1 1h-3l-1 1h-3l-1 1h-3l-1 1h-2l-1 1h-3l-1 1h-2l-1 1h-2l-1 1h-1l-1 1h-3l-1 1h-3l-1 1h-2l-1 1h-1l-1 1h-3l-1 1h-2l-1 1h-2l-1 1h-1l-1 1h-2l-1 1h-2l-1 1h-2l-1 1h-1l-1 1h-2l-1 1h-1l-1 1h-2l-1 1h-1l-1 1h-1l-1 1h-2l-1 1h-1l-1 1h-1l-1 1h-2l-1 1h-1l-2 2h-1l-1 1h-2l-1 1h-1l-1 1h-1l-1 1h-1l-1 1h-1l-1 1h-1l-1 1h-1l-1 1h-1l-1 1h-1l-1 1h-1l-2 2h-2l-2 2h-1l-2 2h-2l-2 2h-1l-2 2h-1l-1 1h-1l-2 2h-1l-1 1h-1l-4 4h-2l-3 3h-1l-2 2h-1l-3 3h-1l-4 4h-1l-3 3h-1l-3 3h-1l-3 3h-1v1l-2 2h-1l-4 4h-1l-8 8h-1l-19 19v1l-6 6v1l-1 1h-1v1l-4 4v1l-4 4v1l-6 6v1l-2 2v1l-3 3v1l-1 1v1l-4 4v1l-2 2v1l-2 2v1l-1 1v1l-4 4v1l-1 1v1l-2 2v2l-3 3v1l-1 1v1l-1 1v1l-1 1v1l-2 2v1l-1 1v1l-1 1v1l-1 1v1l-1 1v2l-1 1v1l-2 2v1l-1 1v2l-1 1v1l-1 1v1l-1 1v1l-1 1v2l-2 2v2l-2 2v3l-1 1v1l-1 1v1l-1 1v2l-1 1v2l-1 1v1l-1 1v2l-1 1v1l-1 1v3l-1 1v2l-1 1v2l-1 1v1l-1 1v3l-1 1v2l-1 1v2l-1 1v3l-1 1v3l-1 1v2l-1 1v3l-1 1v3l-1 1v5l-1 1v2l-1 1v4l-1 1v4l-1 1v5l-1 1v3l-1 1v7l-1 1v3l-1 1v8l-1 1v5l-1 1v9l-1 1v8l-1 1v42l-1 1v1l1 1v1l-1 1v73l1 1v125l-1 1v1l1 1v1l-1 1v1l1 1v2l-1 1 1 1v1l-1 1 1 1v18l-1 1v266l1 1-1 1v53l1 1v30l-1 1v8l1 1v1l-1 1v52l1 1v6l-1 1v1l1 1v1l-1 1v1l1 1v1l-1 1v1l1 1v1l-1 1v1l1 1v2l-1 1 1 1-1 1v431l1 1h40l1-1 1 1 1-1h2l1 1h1l1-1h1l1 1h1l1-1h355l1 1h22l1-1v-88l-1-1h-2l-1-1h-2l-1 1h-9l-1-1-1 1h-217l-1 1h-15l-2-2v-404l1-1v-31l-1-1v-73l1-1v-1l-1-1v-1l1-1v-1l-1-1v-1l1-1v-1l-1-1v-1l1-1v-1l-1-1 1-1v-2l-1-1v-1l1-1-1-1v-31l1-1-1-1 1-1v-14l-1-1v-9l1-1v-137l-1-1v-1l1-1v-5l-1-1v-1l1-1v-1l-1-1v-1l1-1v-1l-1-1v-1l1-1v-1l-1-1v-1l1-1v-1l-1-1v-1l1-1v-26l-1-1 1-1v-276l1-1v-8l1-1v-11l1-1v-6l1-1v-9l1-1v-4l1-1v-6l1-1v-5l1-1v-5l1-1v-4l1-1v-4l1-1v-3l1-1v-4l1-1v-2l1-1v-4l1-1v-2l1-1v-4l1-1v-2l1-1v-2l1-1v-2l1-1v-3l1-1v-1l1-1v-2l1-1v-2l1-1v-2l1-1v-1l1-1v-2l1-1v-1l1-1v-2l1-1v-1l1-1v-1l1-1v-1l1-1v-2l1-1v-1l1-1v-1l1-1v-1l1-1v-2l2-2v-1l1-1v-1l1-1v-1l1-1v-1l2-2v-1l1-1v-1l1-1v-1l3-3v-1l1-1v-1l1-1v-1l2-2v-1l3-3v-1l3-3v-1l3-3v-1l3-3v-1l4-4v-1l13-13v-1l6-6h1l10-10h1l4-4h1l3-3h1l3-3h1l3-3 1 220 2-222h1l3-3h1l1-1h1l2-2h1l2-2h1l1-1h1l2-2h1l1-1h1l2-2h1l1-1h1l1-1h1l1-1h1l2-2h1l1-1h2l1-1h1l2-2h1l1-1h3l1-1h1l1-1h1l1-1h1l1-1h3l1-1h1l1-1h1l1-1h2l1-1h2l1-1h1l1-1h3l1-1h1l1-1h4l1-1h2l1-1h1l1-1h3l1-1h3l1-1h3l1-1h3l1-1h3l1-1h4l1-1h3l1-1h4l1-1h3l1-1h6l1-1h5l1-1h4l1-1h4l1-1h13l1-1h5l1-1h5l1-1v-44l-1-1v-17l1-1v-1l-1-1v-1l1-1-1-1v-6l1-1-1-1v-12h-4l-1-1z" />
	</svg>
);
