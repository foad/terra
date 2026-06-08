import { useMemo, useState } from "react";
import type { ReportFeature } from "../pages/dashboard";
import styles from "./time-slider.module.css";

const STEPS = 1000;
const BUCKETS = 28;

interface Props {
  reports: ReportFeature[];
  filteredCount: number;
  onChange: (from: Date | null, to: Date | null) => void;
}

function fmtDate(d: Date): string {
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

export const TimeSlider = ({ reports, filteredCount, onChange }: Props) => {
  const { minMs, maxMs, bars } = useMemo(() => {
    if (reports.length < 2) return { minMs: 0, maxMs: 0, bars: [] };
    const times = reports.map((r) =>
      new Date(r.properties.submitted_at).getTime(),
    );
    const min = Math.min(...times);
    const max = Math.max(...times);
    if (min === max) return { minMs: min, maxMs: max, bars: [] };
    const counts = new Array(BUCKETS).fill(0);
    const span = max - min;
    times.forEach((t) => {
      const i = Math.min(
        Math.floor(((t - min) / span) * BUCKETS),
        BUCKETS - 1,
      );
      counts[i]++;
    });
    const peak = Math.max(...counts);
    return {
      minMs: min,
      maxMs: max,
      bars: counts.map((c) => c / peak),
    };
  }, [reports]);

  const [fromVal, setFromVal] = useState(0);
  const [toVal, setToVal] = useState(STEPS);

  if (bars.length === 0) return null;

  const span = maxMs - minMs;
  const fromMs = minMs + (fromVal / STEPS) * span;
  const toMs = minMs + (toVal / STEPS) * span;
  const fromPct = (fromVal / STEPS) * 100;
  const toPct = (toVal / STEPS) * 100;
  const isFiltered = fromVal > 0 || toVal < STEPS;

  const fireChange = (fv: number, tv: number) => {
    if (fv === 0 && tv === STEPS) {
      onChange(null, null);
    } else {
      onChange(
        new Date(minMs + (fv / STEPS) * span),
        new Date(minMs + (tv / STEPS) * span),
      );
    }
  };

  const reset = () => {
    setFromVal(0);
    setToVal(STEPS);
    onChange(null, null);
  };

  return (
    <div className={styles.slider}>
      <div className={styles.histogram}>
        {bars.map((h, i) => (
          <div
            key={i}
            className={styles.bar}
            style={{ height: `${Math.max(h * 100, 4)}%` }}
          />
        ))}
      </div>
      <div className={styles.track}>
        <div className={styles.trackBg} />
        <div
          className={styles.trackFill}
          style={{ left: `${fromPct}%`, right: `${100 - toPct}%` }}
        />
        <input
          type="range"
          min={0}
          max={STEPS}
          value={fromVal}
          className={styles.rangeInput}
          style={{ zIndex: fromVal > STEPS / 2 ? 3 : 1 }}
          onChange={(e) => {
            const v = Math.min(Number(e.target.value), toVal - 10);
            setFromVal(v);
            fireChange(v, toVal);
          }}
        />
        <input
          type="range"
          min={0}
          max={STEPS}
          value={toVal}
          className={styles.rangeInput}
          style={{ zIndex: fromVal > STEPS / 2 ? 1 : 3 }}
          onChange={(e) => {
            const v = Math.max(Number(e.target.value), fromVal + 10);
            setToVal(v);
            fireChange(fromVal, v);
          }}
        />
      </div>
      <div className={styles.labels}>
        <span className={styles.label}>{fmtDate(new Date(fromMs))}</span>
        <span className={styles.center}>
          {isFiltered ? (
            <>
              <span className={styles.count}>
                {filteredCount} of {reports.length}
              </span>
              {" · "}
              <button className={styles.reset} onClick={reset}>
                reset
              </button>
            </>
          ) : (
            <span className={styles.hint}>drag to filter by time</span>
          )}
        </span>
        <span className={styles.label}>{fmtDate(new Date(toMs))}</span>
      </div>
    </div>
  );
};
