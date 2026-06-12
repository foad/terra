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
  const day = String(d.getDate()).padStart(2, "0");
  const mon = d.toLocaleString("default", { month: "short" });
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${mon} ${hh}:${mm}`;
}

export const TimeSlider = ({ reports, filteredCount, onChange }: Props) => {
  const { paddedMin, maxMs, bars } = useMemo(() => {
    if (reports.length < 2) return { paddedMin: 0, maxMs: 0, bars: [] };
    let min = Infinity;
    let max = -Infinity;
    const times = new Array<number>(reports.length);
    for (let i = 0; i < reports.length; i++) {
      const t = new Date(reports[i].properties.submitted_at).getTime();
      times[i] = t;
      if (t < min) min = t;
      if (t > max) max = t;
    }
    if (min === max) return { paddedMin: min, maxMs: max, bars: [] };
    const span = max - min;
    // Extend one step before the first event so the from handle can sit
    // at "just before all reports" rather than exactly at the first one.
    const padded = min - span / STEPS;
    // Bucket width depends on min/max, so bucketing needs a second pass —
    // but over the cached timestamps, so each date is only parsed once.
    const counts = new Array(BUCKETS).fill(0);
    let peak = 0;
    for (const t of times) {
      const i = Math.min(
        Math.floor(((t - padded) / (max - padded)) * BUCKETS),
        BUCKETS - 1,
      );
      counts[i]++;
      if (counts[i] > peak) peak = counts[i];
    }
    return {
      paddedMin: padded,
      maxMs: max,
      bars: counts.map((c) => c / peak),
    };
  }, [reports]);

  const [fromVal, setFromVal] = useState(0);
  const [toVal, setToVal] = useState(STEPS);
  // Track which handle was last pointer-downed so its z-index stays elevated
  // during the full drag — prevents the handle losing pointer capture when
  // both thumbs cross the midpoint.
  const [lastTouched, setLastTouched] = useState<"from" | "to">("to");

  if (bars.length === 0) {
    return (
      <div className={styles.slider} style={{ opacity: 0.45, pointerEvents: "none" }}>
        <div className={styles.histogram}>
          {Array.from({ length: BUCKETS }, (_, i) => (
            <div key={i} className={styles.bar} style={{ height: "4px" }} />
          ))}
        </div>
        <div className={styles.track}>
          <div className={styles.trackBg} />
          <div className={styles.trackFill} style={{ left: "0%", right: "0%" }} />
          <input type="range" min={0} max={STEPS} value={0} className={styles.rangeInput} onChange={() => {}} disabled />
          <input type="range" min={0} max={STEPS} value={STEPS} className={styles.rangeInput} onChange={() => {}} disabled />
        </div>
        <div className={styles.labels}>
          <span className={styles.label}>—</span>
          <span className={styles.center}><span className={styles.hint}>no reports yet</span></span>
          <span className={styles.label}>—</span>
        </div>
      </div>
    );
  }

  const span = maxMs - paddedMin;
  const fromMs = paddedMin + (fromVal / STEPS) * span;
  const toMs = paddedMin + (toVal / STEPS) * span;
  const fromPct = (fromVal / STEPS) * 100;
  const toPct = (toVal / STEPS) * 100;
  const isFiltered = fromVal > 0 || toVal < STEPS;

  const fireChange = (fv: number, tv: number) => {
    // from=0 means "from the very beginning" regardless of to position
    const fromDate = fv === 0 ? null : new Date(paddedMin + (fv / STEPS) * span);
    const toDate = tv === STEPS ? null : new Date(paddedMin + (tv / STEPS) * span);
    if (!fromDate && !toDate) {
      onChange(null, null);
    } else {
      onChange(fromDate, toDate);
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
          style={{ zIndex: lastTouched === "from" ? 3 : 1 }}
          onPointerDown={() => setLastTouched("from")}
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
          style={{ zIndex: lastTouched === "to" ? 3 : 1 }}
          onPointerDown={() => setLastTouched("to")}
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
