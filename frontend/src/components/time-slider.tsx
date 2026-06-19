import { useMemo, useState } from "react";
import * as Slider from "@radix-ui/react-slider";
import type { ReportFeature } from "../pages/dashboard";
import styles from "./time-slider.module.css";

const STEPS = 1000;
const BUCKETS = 100;
const MIN_GAP = 10;

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
    const sp = max - min;
    // Extend one step before the first event so the from handle can sit
    // at "just before all reports" rather than exactly at the first one.
    const padded = min - sp / STEPS;
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
    const logPeak = Math.log(peak + 1);
    return {
      paddedMin: padded,
      maxMs: max,
      bars: counts.map((c) => (c === 0 ? 0 : Math.log(c + 1) / logPeak)),
    };
  }, [reports]);

  const [range, setRange] = useState<[number, number]>([0, STEPS]);
  const [fromVal, toVal] = range;

  const empty = bars.length === 0;
  const span = maxMs - paddedMin;
  const fromMs = empty ? 0 : paddedMin + (fromVal / STEPS) * span;
  const toMs = empty ? 0 : paddedMin + (toVal / STEPS) * span;
  const isFiltered = !empty && (fromVal > 0 || toVal < STEPS);

  // Always emit concrete dates whenever ANY handle has moved — otherwise the
  // dashboard's `from && to` gate drops single-sided filters and the count
  // appears stuck at "N of N".
  const fireChange = (fv: number, tv: number) => {
    if (fv === 0 && tv === STEPS) {
      onChange(null, null);
    } else {
      onChange(
        new Date(paddedMin + (fv / STEPS) * span),
        new Date(paddedMin + (tv / STEPS) * span),
      );
    }
  };

  const handleChange = (next: number[]) => {
    const tuple: [number, number] = [next[0], next[1]];
    setRange(tuple);
    fireChange(tuple[0], tuple[1]);
  };

  const reset = () => {
    setRange([0, STEPS]);
    onChange(null, null);
  };

  const displayBars = empty ? new Array<number>(BUCKETS).fill(0) : bars;
  const fromFrac = fromVal / STEPS;
  const toFrac = toVal / STEPS;
  const barWidthPct = 100 / BUCKETS;

  return (
    <div className={styles.slider}>
      <div className={`${styles.chart} ${empty ? styles.chartDisabled : ""}`}>
        <div className={styles.bars}>
          {displayBars.map((h, i) => {
            const left = i / BUCKETS;
            const right = (i + 1) / BUCKETS;
            const inRange = left >= fromFrac && right <= toFrac;
            const heightPct = h === 0 ? 2 : Math.max(h * 100, 6);
            return (
              <div
                key={i}
                className={`${styles.bar} ${inRange ? styles.barActive : ""} ${h === 0 ? styles.barEmpty : ""}`}
                style={{
                  left: `${left * 100}%`,
                  width: `calc(${barWidthPct}% - 2px)`,
                  height: `${heightPct}%`,
                }}
              />
            );
          })}
        </div>
        <Slider.Root
          className={styles.sliderRoot}
          min={0}
          max={STEPS}
          step={1}
          minStepsBetweenThumbs={MIN_GAP}
          value={range}
          onValueChange={handleChange}
          disabled={empty}
        >
          <Slider.Track className={styles.sliderTrack} />
          <Slider.Thumb className={styles.sliderThumb} aria-label="From" />
          <Slider.Thumb className={styles.sliderThumb} aria-label="To" />
        </Slider.Root>
      </div>
      <div className={styles.labels}>
        <span className={styles.label}>
          {empty ? "—" : fmtDate(new Date(fromMs))}
        </span>
        <span className={styles.center}>
          {empty ? (
            <span className={styles.hint}>no reports yet</span>
          ) : (
            <>
              <span className={styles.count}>
                {filteredCount} of {reports.length}
              </span>
              {isFiltered && (
                <>
                  {" · "}
                  <button className={styles.reset} onClick={reset}>
                    reset
                  </button>
                </>
              )}
            </>
          )}
        </span>
        <span className={styles.label}>
          {empty ? "—" : fmtDate(new Date(toMs))}
        </span>
      </div>
    </div>
  );
};
