// Hand-drawn 24×24 stroke icons (no icon library). Decorative: always aria-hidden, so the
// control that holds an icon must have its own accessible name.

const PATHS = {
  today: <path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  routines: <path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" />,
  progress: <path d="M5 20v-7M11 20V5M17 20v-10M3 20.5h18" />,
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  themeAuto: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  back: <path d="M15 5l-7 7 7 7" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  chevronUp: <path d="M5 15l7-7 7 7" />,
  chevronDown: <path d="M5 9l7 7 7-7" />,
  trash: (
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5h6V7" />
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.5h.01" />
    </>
  ),
  cloud: <path d="M7 19h10.5a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.34 9.5 4.75 4.75 0 0 0 7 19z" />,
  cloudOff: (
    <path d="M7 19h10.5M20.6 16.6A4 4 0 0 0 18 11.03 6 6 0 0 0 9.2 6.2M6.34 9.5A4.75 4.75 0 0 0 7 19M3 3l18 18" />
  ),
  refresh: (
    <path d="M19.5 10A8 8 0 0 0 5.2 7.5M4.5 4v4h4M4.5 14a8 8 0 0 0 14.3 2.5M19.5 20v-4h-4" />
  ),
  warning: (
    <>
      <path d="M10.3 4.3L2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4.5M12 17h.01" />
    </>
  ),
  download: <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  /** Pixel size of the square icon. */
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function Icon({ name, size = 24, strokeWidth = 2, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
