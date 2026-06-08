import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DashboardMap } from "../components/dashboard-map";
import { DAMAGE_COLORS } from "../components/damage-colors";
import { DashboardSidebar } from "../components/dashboard-sidebar";
import { ReportDetailsModal } from "../components/report-details-modal";
import { TimeSlider } from "../components/time-slider";
import { api } from "../utils/api";
import styles from "./dashboard.module.css";

export interface ReportFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    id: string;
    building_id: string | null;
    damage_level: string;
    ai_damage_level: string | null;
    ai_confidence: number | null;
    photo_url: string | null;
    thumbnail_url: string | null;
    infrastructure_type: string[];
    infrastructure_description: string | null;
    crisis_nature: string[];
    debris_present: boolean | null;
    electricity_status: string | null;
    health_status: string | null;
    pressing_needs: string[];
    version_chain_id: string;
    is_latest: boolean;
    submitted_at: string;
    version_count: number;
    follow_up_responses: Record<string, string> | null;
  };
}

export interface Filters {
  damageLevel: string[];
  infrastructureType: string[];
  crisisNature: string[];
  from: string;
  to: string;
}

const STATS_REFRESH_MS = 60_000;

const EMPTY_FILTERS: Filters = {
  damageLevel: [],
  infrastructureType: [],
  crisisNature: [],
  from: "",
  to: "",
};

const DashboardPage = () => {
  const { t } = useTranslation();
  const [reports, setReports] = useState<ReportFeature[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedReport, setSelectedReport] = useState<ReportFeature | null>(
    null,
  );
  const [history, setHistory] = useState<ReportFeature[]>([]);
  const [detailsReport, setDetailsReport] = useState<ReportFeature | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [timeWindow, setTimeWindow] = useState<{
    from: Date;
    to: Date;
  } | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), STATS_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const counts = { minimal: 0, partial: 0, complete: 0 };
    let last24h = 0;
    const cutoff = now - 24 * 60 * 60 * 1000;
    for (const r of reports) {
      const level = r.properties.damage_level as keyof typeof counts;
      if (level in counts) counts[level]++;
      if (new Date(r.properties.submitted_at).getTime() > cutoff) last24h++;
    }
    return { ...counts, last24h };
  }, [reports, now]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.damageLevel.length > 0)
        params.set("damage_level", filters.damageLevel.join(","));
      if (filters.infrastructureType.length > 0)
        params.set("infrastructure_type", filters.infrastructureType.join("|"));
      if (filters.crisisNature.length > 0)
        params.set("crisis_nature", filters.crisisNature.join("|"));
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      params.set("limit", "1000");

      let allFeatures: ReportFeature[] = [];
      let offset = 0;
      let totalCount = 0;
      while (true) {
        params.set("offset", String(offset));
        const data = await api(`/reports?${params.toString()}`);
        allFeatures = allFeatures.concat(data.features);
        totalCount = data.total;
        if (allFeatures.length >= totalCount) break;
        offset = allFeatures.length;
      }

      if (!cancelled) {
        setReports(allFeatures);
        setTotal(totalCount);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  useEffect(() => {
    const buildingId = selectedReport?.properties.building_id;
    let cancelled = false;
    (async () => {
      if (!buildingId) {
        if (!cancelled) setHistory([]);
        return;
      }
      try {
        const data = await api(
          `/reports?building_id=${encodeURIComponent(buildingId)}&limit=100`,
        );
        if (!cancelled) setHistory(data.features ?? []);
      } catch {
        if (!cancelled) setHistory([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedReport?.properties.building_id]);

  const filteredReports = useMemo(() => {
    if (!timeWindow) return reports;
    const from = timeWindow.from.getTime();
    const to = timeWindow.to.getTime();
    return reports.filter((r) => {
      const t = new Date(r.properties.submitted_at).getTime();
      return t >= from && t <= to;
    });
  }, [reports, timeWindow]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <h1 className={styles.title}>TERRA</h1>
          <span className={styles.subtitle}>Dashboard</span>
          <span className={styles.reportCount}>
            {loading
              ? "Loading..."
              : timeWindow
                ? `${filteredReports.length} of ${total} reports`
                : `${total} reports`}
          </span>
        </div>
      </header>
      <div className={styles.statsBar}>
        <div className={styles.statItem}>
          <span
            className={styles.statDot}
            style={{ background: DAMAGE_COLORS.complete }}
          />
          <span className={styles.statValue}>
            {loading ? "—" : stats.complete}
          </span>
          <span className={styles.statLabel}>
            {t("dashboard.levelComplete")}
          </span>
        </div>
        <div className={styles.statItem}>
          <span
            className={styles.statDot}
            style={{ background: DAMAGE_COLORS.partial }}
          />
          <span className={styles.statValue}>
            {loading ? "—" : stats.partial}
          </span>
          <span className={styles.statLabel}>
            {t("dashboard.levelPartial")}
          </span>
        </div>
        <div className={styles.statItem}>
          <span
            className={styles.statDot}
            style={{ background: DAMAGE_COLORS.minimal }}
          />
          <span className={styles.statValue}>
            {loading ? "—" : stats.minimal}
          </span>
          <span className={styles.statLabel}>
            {t("dashboard.levelMinimal")}
          </span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statValue}>
            {loading ? "—" : stats.last24h}
          </span>
          <span className={styles.statLabel}>{t("dashboard.last24h")}</span>
        </div>
      </div>
      <div className={styles.body}>
        <DashboardSidebar
          filters={filters}
          onFiltersChange={setFilters}
          selectedReport={selectedReport}
          history={history}
          onShowDetails={setDetailsReport}
          onClearSelection={() => setSelectedReport(null)}
        />
        <div className={styles.mapArea}>
          <div className={styles.mapWrapper}>
            <DashboardMap
              reports={filteredReports}
              onReportSelect={setSelectedReport}
            />
          </div>
          <TimeSlider
            reports={reports}
            filteredCount={filteredReports.length}
            onChange={(from, to) =>
              setTimeWindow(from && to ? { from, to } : null)
            }
          />
        </div>
      </div>
      {detailsReport && (
        <ReportDetailsModal
          report={detailsReport}
          onClose={() => setDetailsReport(null)}
        />
      )}
    </div>
  );
};

export default DashboardPage;
