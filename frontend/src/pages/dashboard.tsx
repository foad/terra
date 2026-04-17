import { useState, useEffect, useCallback } from "react";
import { DashboardMap } from "../components/dashboard-map";
import { DashboardSidebar } from "../components/dashboard-sidebar";
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
    s2_id: string | null;
    location_description: string | null;
    damage_level: string;
    ai_damage_level: string | null;
    ai_confidence: number | null;
    photo_url: string | null;
    infrastructure_type: string[];
    infrastructure_name: string | null;
    crisis_nature: string[];
    debris_present: boolean | null;
    electricity_status: string | null;
    health_status: string | null;
    pressing_needs: string[];
    version_chain_id: string;
    is_latest: boolean;
    submitted_at: string;
    version_count: number;
  };
}

export interface Filters {
  damageLevel: string[];
  infrastructureType: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = {
  damageLevel: [],
  infrastructureType: "",
  from: "",
  to: "",
};

const DashboardPage = () => {
  const [reports, setReports] = useState<ReportFeature[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedReport, setSelectedReport] = useState<ReportFeature | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();

    if (filters.damageLevel.length > 0) {
      params.set("damage_level", filters.damageLevel.join(","));
    }
    if (filters.infrastructureType) {
      params.set("infrastructure_type", filters.infrastructureType);
    }
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);

    const qs = params.toString();
    const data = await api(`/reports${qs ? `?${qs}` : ""}`);
    setReports(data.features);
    setTotal(data.total);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <h1 className={styles.title}>TERRA</h1>
          <span className={styles.subtitle}>Dashboard</span>
          <span className={styles.reportCount}>
            {loading ? "Loading..." : `${total} reports`}
          </span>
        </div>
      </header>
      <div className={styles.body}>
        <DashboardSidebar
          filters={filters}
          onFiltersChange={setFilters}
          selectedReport={selectedReport}
          onClearSelection={() => setSelectedReport(null)}
        />
        <div className={styles.mapArea}>
          <DashboardMap
            reports={reports}
            onReportSelect={setSelectedReport}
          />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
