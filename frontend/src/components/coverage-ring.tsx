import styles from "./coverage-ring.module.css";

// SVG ring geometry — 48×48 viewBox, centre (24,24), radius 17.
const CX = 24;
const CY = 24;
const R = 17;
const SW = 4.5;
const CIRC = 2 * Math.PI * R; // ≈ 106.8

// House silhouette with door cutout (evenodd fill-rule).
// Roof peak (24,19), base y=33, door 21–27 × 28–33.
const HOUSE =
  "M24,19 L32,27 L30,27 L30,33 L18,33 L18,27 L16,27 Z" +
  " M21,28 L27,28 L27,33 L21,33 Z";

interface CoverageRingProps {
  assessed: number;
  total: number;
  label: string;
}

export const CoverageRing = ({ assessed, total, label }: CoverageRingProps) => {
  const ratio = total > 0 ? Math.min(assessed / total, 1) : 0;
  const offset = CIRC * (1 - ratio);
  const complete = ratio >= 1 && total > 0;

  return (
    <div className={styles.card}>
      <svg
        width={48}
        height={48}
        viewBox="0 0 48 48"
        className={styles.svg}
        aria-hidden="true"
      >
        {/* Track */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#e2e8f0" strokeWidth={SW} />
        {/* Teal arc — transitions on update */}
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="#14b8a6"
          strokeWidth={SW}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${CX} ${CY})`}
          className={styles.arc}
        />
        {/* House glyph: outline while in progress, solid teal when complete */}
        <path
          d={HOUSE}
          fillRule="evenodd"
          fill={complete ? "#14b8a6" : "none"}
          stroke={complete ? "none" : "#94a3b8"}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <span className={styles.label}>{label}</span>
    </div>
  );
};
