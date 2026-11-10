import styles from './Logo.module.css';

interface LogoProps {
  /** Side in pixels. */
  size?: number;
  className?: string;
}

/**
 * The Certavi mark: an Olympic plate shaped like a "C" on a rounded tile (same drawing as
 * `public/icon.svg`). Decoration only: it has no name, so screen readers skip it.
 */
export function Logo({ size = 28, className }: LogoProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden="true"
      focusable="false"
    >
      <rect className={styles.tile} width="512" height="512" rx="112" />
      <circle
        className={styles.plate}
        cx="256"
        cy="256"
        r="118"
        fill="none"
        strokeWidth="64"
        strokeDasharray="576.6 164.8"
        transform="rotate(40 256 256)"
      />
      <circle className={styles.hub} cx="256" cy="256" r="24" />
    </svg>
  );
}
