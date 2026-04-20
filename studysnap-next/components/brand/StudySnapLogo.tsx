import type { CSSProperties } from 'react';

interface StudySnapLogoProps {
  /** Height in px. Width auto-derives from the 130×120 viewBox aspect ratio. */
  size?: number;
  /** Render the "StudySnap" wordmark next to the icon. */
  showWordmark?: boolean;
  /** Class applied to the outer wrapper (DOM usage only — ignored by Satori). */
  className?: string;
  /** Inline style for the wrapper. Use when rendering inside next/og ImageResponse. */
  style?: CSSProperties;
  /** Override the mint color. Defaults to `currentColor` (inherit from parent `color`). */
  color?: string;
  /** Color shown in the title-line cutouts of the top book. Default `#09090b` (ink-950). */
  cutoutColor?: string;
  /** Color for the wordmark text. Default `#ffffff`. */
  wordmarkColor?: string;
  /** Gap in px between icon and wordmark. Defaults to `size * 0.32`. */
  gap?: number;
  /** Font-size override for wordmark in px. Defaults to `size * 0.52`. */
  wordmarkSize?: number;
}

/**
 * StudySnap brand mark — three stacked books with a mint accent dot.
 *
 * Renders pure SVG with inline styles so it works both in React DOM
 * AND inside Vercel/Satori `ImageResponse` (favicon, apple-icon, OG).
 */
export function StudySnapLogo({
  size = 32,
  showWordmark = false,
  className,
  style,
  color = 'currentColor',
  cutoutColor = '#09090b',
  wordmarkColor = '#ffffff',
  gap,
  wordmarkSize,
}: StudySnapLogoProps) {
  const aspect = 130 / 120;
  const iconWidth = Math.round(size * aspect);
  const resolvedGap = gap ?? Math.max(6, Math.round(size * 0.32));
  const resolvedWordmarkSize = wordmarkSize ?? Math.max(12, Math.round(size * 0.52));

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${resolvedGap}px`,
        ...style,
      }}
    >
      <svg
        viewBox="0 0 130 120"
        width={iconWidth}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={showWordmark ? undefined : 'StudySnap'}
        aria-hidden={showWordmark ? true : undefined}
      >
        {/* bottom book */}
        <rect x="20" y="70" width="90" height="14" rx="2" fill="none" stroke={color} strokeWidth="2" />
        <rect x="24" y="73" width="82" height="8" fill={color} opacity="0.15" />
        <line x1="30" y1="77" x2="100" y2="77" stroke={color} strokeWidth="0.8" opacity="0.6" />

        {/* middle book (tilted) */}
        <g transform="rotate(-3 65 58)">
          <rect x="10" y="50" width="110" height="16" rx="2" fill="none" stroke={color} strokeWidth="2" />
          <rect x="14" y="53" width="102" height="10" fill={color} opacity="0.15" />
        </g>

        {/* top book (filled, main element) */}
        <rect x="35" y="12" width="60" height="38" rx="2" fill={color} />
        <rect x="40" y="17" width="50" height="4"   fill={cutoutColor} opacity="0.7" />
        <rect x="40" y="25" width="40" height="2.5" fill={cutoutColor} opacity="0.5" />
        <rect x="40" y="31" width="44" height="2.5" fill={cutoutColor} opacity="0.5" />
        <rect x="40" y="37" width="36" height="2.5" fill={cutoutColor} opacity="0.5" />

        {/* accent dot */}
        <circle cx="118" cy="22" r="4" fill={color} />
      </svg>

      {showWordmark && (
        <span
          style={{
            fontSize: `${resolvedWordmarkSize}px`,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: wordmarkColor,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          StudySnap
        </span>
      )}
    </div>
  );
}
