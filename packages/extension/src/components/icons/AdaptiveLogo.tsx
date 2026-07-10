import type React from 'react'

import { LogoIcon } from './LogoIcon'
import { useContrastColor } from './use-contrast-color'

type IconProps = React.SVGProps<SVGSVGElement>

/**
 * Full Cícero mark (red C + brackets). Bracket color auto-adapts via
 * WCAG contrast against the effective background (black on light, white on dark).
 * Logo path data is not edited — only fill inheritance via currentColor.
 */
export function AdaptiveLogo({ className, style, ...props }: IconProps) {
	const { color, ref } = useContrastColor()

	return (
		<span
			ref={ref}
			className={className}
			style={{ display: 'inline-flex', color, lineHeight: 0, ...style }}
		>
			{/* fill="currentColor" is inherited by the unfilled bracket path;
			    the red C path keeps its explicit fill="#f21b23". */}
			<LogoIcon fill="currentColor" className="h-full w-full" aria-hidden {...props} />
		</span>
	)
}
