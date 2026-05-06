import { CircleCheck, TriangleAlert, CircleX, X } from "lucide-react";
import type { ReactNode } from "react";
import type { Filters, ReportFeature } from "../pages/dashboard";
import { MultiSelect } from "./multi-select";
import styles from "./dashboard-sidebar.module.css";

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
}

export const DashboardSidebar = ({
  filters,
  onFiltersChange,
  selectedReport,
  history,
  onShowDetails,
  onClearSelection,
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
            {selectedReport.properties.infrastructure_name && (
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Name</div>
                <div className={styles.fieldValue}>
                  {selectedReport.properties.infrastructure_name}
                </div>
              </div>
            )}
            <ul className={styles.historyList}>
              {(history.length > 0 ? history : [selectedReport]).map((r) => (
                  <li
                    key={r.properties.id}
                    className={styles.historyItem}
                  >
                    {(r.properties.thumbnail_url || r.properties.photo_url) ? (
                      <img
                        src={r.properties.thumbnail_url ?? r.properties.photo_url ?? ""}
                        alt=""
                        className={styles.historyThumb}
                        loading="lazy"
                      />
                    ) : (
                      <div className={styles.historyThumbPlaceholder} />
                    )}
                    <div className={styles.historyMeta}>
                      <div className={styles.historyMetaTop}>
                        <span className={`${styles.damageBadge} ${styles[r.properties.damage_level]}`}>
                          {r.properties.damage_level}
                        </span>
                        {r.properties.is_latest && (
                          <span className={styles.currentTag}>Current</span>
                        )}
                      </div>
                      <div className={styles.historyDate}>
                        {new Date(r.properties.submitted_at).toLocaleString()}
                      </div>
                      {r.properties.location_description && (
                        <div className={styles.historyDesc}>
                          {r.properties.location_description}
                        </div>
                      )}
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
        </div>
      )}
    </aside>
  );
};
