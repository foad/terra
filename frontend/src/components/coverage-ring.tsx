import { Building } from "lucide-react";
import styles from "./coverage-ring.module.css";

// SVG ring geometry — 48×48 viewBox, centre (24,24), radius 17.
const CX = 24;
const CY = 24;
const R = 17;
const SW = 4.5;
const CIRC = 2 * Math.PI * R; // ≈ 106.8

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
      <div className={styles.ring_container}>
        <svg
          width={48}
          height={48}
          viewBox="0 0 48 48"
          className={styles.svg}
          aria-hidden="true"
        >
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={SW}
          />
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
        </svg>
        <Building
          className={`${styles.icon} ${complete ? styles.icon_complete : ""}`}
          size={20}
        />
      </div>
      <span className={styles.label}>{label}</span>
    </div>
  );
};
