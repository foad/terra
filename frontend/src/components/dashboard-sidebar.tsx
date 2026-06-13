import { CircleCheck, TriangleAlert, CircleX, Download, X, PenLine } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "react-oidc-context";
import type { Filters, ReportFeature } from "../pages/dashboard";
import { API_BASE } from "../utils/api";
import { MultiSelect } from "./multi-select";
import styles from "./dashboard-sidebar.module.css";

const CSV_HEADERS = [
  "id", "building_id", "damage_level", "infrastructure_type", "crisis_nature",
  "debris_present", "electricity_status", "health_status", "pressing_needs",
  "infrastructure_description", "submitted_at", "latitude", "longitude",
  "ai_damage_level", "ai_confidence", "version_chain_id",
];

function toCSV(reports: ReportFeature[]): string {
  const escape = (v: unknown) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = reports.map((r) => {
    const p = r.properties;
    const [lng, lat] = r.geometry.coordinates;
    return [
      p.id, p.building_id ?? "", p.damage_level,
      p.infrastructure_type.join("|"), p.crisis_nature.join("|"),
      p.debris_present ?? "", p.electricity_status ?? "", p.health_status ?? "",
      p.pressing_needs.join("|"), p.infrastructure_description ?? "",
      p.submitted_at, lat, lng,
      p.ai_damage_level ?? "", p.ai_confidence ?? "", p.version_chain_id,
    ].map(escape).join(",");
  });
  return [CSV_HEADERS.join(","), ...rows].join("\n");
}

function downloadBlob(content: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const CRISIS_NATURES = [
  "Earthquake",
  "Flood",
  "Tsunami",
  "Hurricane/Cyclone",
  "Wildfire",
  "Explosion",
  "Chemical incident",
  "Conflict",
  "Civil unrest",
];

const INFRASTRUCTURE_TYPES = [
  "Residential Infrastructure (Houses and apartments)",
  "Commercial Infrastructure (Markets, malls, shops, hotels, banks, industries, etc.)",
  "Government Building (Administrative buildings, courthouses, police stations, fire stations, etc.)",
  "Utility Infrastructure (Water pumps, power plants, waste treatment plants, etc.)",
  "Transport and Communication Infrastructure (Roads, cell towers, bridges, railway station, bus station, etc.)",
  "Community Infrastructure (Schools, hospitals, community halls, public toilets, etc.)",
  "Public spaces/Recreation Infrastructure (stadiums, playgrounds, religious buildings, etc.)",
];

const DAMAGE_LEVELS: { value: string; label: string; icon: ReactNode }[] = [
  { value: "minimal", label: "Minimal", icon: <CircleCheck size={16} /> },
  { value: "partial", label: "Partial", icon: <TriangleAlert size={16} /> },
  { value: "complete", label: "Complete", icon: <CircleX size={16} /> },
];

interface DashboardSidebarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  selectedReport: ReportFeature | null;
  history: ReportFeature[];
  onShowDetails: (report: ReportFeature) => void;
  onClearSelection: () => void;
  polygonActive?: boolean;
  filteredReports?: ReportFeature[];
}

export const DashboardSidebar = ({
  filters,
  onFiltersChange,
  selectedReport,
  history,
  onShowDetails,
  onClearSelection,
  polygonActive = false,
  filteredReports = [],
}: DashboardSidebarProps) => {
  const toggleDamageLevel = (level: string) => {
    const updated = filters.damageLevel.includes(level)
      ? filters.damageLevel.filter((l) => l !== level)
      : [...filters.damageLevel, level];
    onFiltersChange({ ...filters, damageLevel: updated });
  };

  const hasActiveFilters =
    filters.damageLevel.length > 0 ||
    filters.infrastructureType.length > 0 ||
    filters.crisisNature.length > 0 ||
    filters.from !== "" ||
    filters.to !== "";

  const auth = useAuth();

  const downloadExport = async (format: "csv" | "geojson") => {
    const params = new URLSearchParams({ format });
    if (filters.damageLevel.length > 0)
      params.set("damage_level", filters.damageLevel.join(","));
    if (filters.infrastructureType.length > 0)
      params.set("infrastructure_type", filters.infrastructureType.join("|"));
    if (filters.crisisNature.length > 0)
      params.set("crisis_nature", filters.crisisNature.join("|"));
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);

    const token = auth.user?.access_token;
    const res = await fetch(`${API_BASE}/reports/export?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error(`Export failed: ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const filename =
      res.headers
        .get("Content-Disposition")
        ?.match(/filename="?([^"]+)"?/)?.[1] ?? `terra-reports.${format}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className={styles.sidebar}>
      {selectedReport ? (
        <div className={styles.detail}>
          <div className={styles.detailHeader}>
            <h2 className={styles.detailTitle}>
              {history.length > 1
                ? `${history.length} reports for this building`
                : "Report Detail"}
            </h2>
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClearSelection}
            >
              <X size={18} />
            </button>
          </div>
          <div className={styles.detailBody}>
            {selectedReport.properties.infrastructure_description && (
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Description</div>
                <div className={styles.fieldValue}>
                  {selectedReport.properties.infrastructure_description}
                </div>
              </div>
            )}
            <ul className={styles.historyList}>
              {(history.length > 0 ? history : [selectedReport]).map((r) => (
                <li key={r.properties.id} className={styles.historyItem}>
                  {r.properties.thumbnail_url || r.properties.photo_url ? (
                    <img
                      src={
                        r.properties.thumbnail_url ??
                        r.properties.photo_url ??
                        ""
                      }
                      alt=""
                      className={styles.historyThumb}
                      loading="lazy"
                    />
                  ) : (
                    <div className={styles.historyThumbPlaceholder} />
                  )}
                  <div className={styles.historyMeta}>
                    <div className={styles.historyMetaTop}>
                      <span
                        className={`${styles.damageBadge} ${styles[r.properties.damage_level]}`}
                      >
                        {r.properties.damage_level}
                      </span>
                      {r.properties.is_latest && (
                        <span className={styles.currentTag}>Current</span>
                      )}
                    </div>
                    <div className={styles.historyDate}>
                      {new Date(r.properties.submitted_at).toLocaleString()}
                    </div>
                    <button
                      type="button"
                      className={styles.detailsButton}
                      onClick={() => onShowDetails(r)}
                    >
                      Details
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className={styles.filters}>
          {polygonActive && (
            <div className={styles.polygonBadge}>
              <PenLine size={12} />
              Area filter active — clear via map
            </div>
          )}
          <div className={styles.filtersHeader}>
            <h2 className={styles.filtersTitle}>Filters</h2>
            {hasActiveFilters && (
              <button
                type="button"
                className={styles.clearButton}
                onClick={() =>
                  onFiltersChange({
                    damageLevel: [],
                    infrastructureType: [],
                    crisisNature: [],
                    from: "",
                    to: "",
                  })
                }
              >
                Clear all
              </button>
            )}
          </div>

          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>Damage Level</div>
            <div className={styles.damageButtons}>
              {DAMAGE_LEVELS.map((level) => {
                const isActive = filters.damageLevel.includes(level.value);
                return (
                  <button
                    key={level.value}
                    type="button"
                    className={`${styles.damageButton} ${styles[level.value]} ${isActive ? styles.active : ""}`}
                    onClick={() => toggleDamageLevel(level.value)}
                    aria-pressed={isActive}
                  >
                    {level.icon}
                    <span>{level.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>Infrastructure Type</div>
            <MultiSelect
              label="All types"
              options={INFRASTRUCTURE_TYPES.map((type) => ({
                value: type,
                label: type.split("(")[0].trim(),
              }))}
              selected={filters.infrastructureType}
              onChange={(selected) =>
                onFiltersChange({ ...filters, infrastructureType: selected })
              }
            />
          </div>

          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>Crisis Type</div>
            <MultiSelect
              label="All crisis types"
              options={CRISIS_NATURES.map((n) => ({ value: n, label: n }))}
              selected={filters.crisisNature}
              onChange={(selected) =>
                onFiltersChange({ ...filters, crisisNature: selected })
              }
            />
          </div>

          <div className={styles.filterGroup}>
            <div className={styles.filterLabel}>Date Range</div>
            <div className={styles.dateRange}>
              <div className={styles.dateField}>
                <label htmlFor="filter-from">From</label>
                <input
                  type="date"
                  id="filter-from"
                  value={filters.from}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, from: e.target.value })
                  }
                />
              </div>
              <div className={styles.dateField}>
                <label htmlFor="filter-to">To</label>
                <input
                  type="date"
                  id="filter-to"
                  value={filters.to}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, to: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className={styles.exportGroup}>
            <div className={styles.filterLabel}>Export</div>
            <div className={styles.exportButtons}>
              {polygonActive ? (
                <>
                  <button
                    type="button"
                    className={styles.exportButton}
                    onClick={() =>
                      downloadBlob(
                        toCSV(filteredReports),
                        "terra-export.csv",
                        "text/csv",
                      )
                    }
                  >
                    <Download size={14} />
                    CSV
                  </button>
                  <button
                    type="button"
                    className={styles.exportButton}
                    onClick={() =>
                      downloadBlob(
                        JSON.stringify(
                          { type: "FeatureCollection", features: filteredReports },
                          null,
                          2,
                        ),
                        "terra-export.geojson",
                        "application/geo+json",
                      )
                    }
                  >
                    <Download size={14} />
                    GeoJSON
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.exportButton}
                    onClick={() => downloadExport("csv")}
                  >
                    <Download size={14} />
                    CSV
                  </button>
                  <button
                    type="button"
                    className={styles.exportButton}
                    onClick={() => downloadExport("geojson")}
                  >
                    <Download size={14} />
                    GeoJSON
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
