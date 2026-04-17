import { CircleCheck, TriangleAlert, CircleX, X } from "lucide-react";
import type { ReactNode } from "react";
import type { Filters, ReportFeature } from "../pages/dashboard";
import { MultiSelect } from "./multi-select";
import styles from "./dashboard-sidebar.module.css";

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
  onClearSelection: () => void;
}

export const DashboardSidebar = ({
  filters,
  onFiltersChange,
  selectedReport,
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
    filters.from !== "" ||
    filters.to !== "";

  return (
    <aside className={styles.sidebar}>
      {selectedReport ? (
        <div className={styles.detail}>
          <div className={styles.detailHeader}>
            <h2 className={styles.detailTitle}>Report Detail</h2>
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClearSelection}
            >
              <X size={18} />
            </button>
          </div>
          <div className={styles.detailBody}>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Damage Level</div>
              <div className={`${styles.damageBadge} ${styles[selectedReport.properties.damage_level]}`}>
                {selectedReport.properties.damage_level}
              </div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Infrastructure</div>
              <div className={styles.fieldValue}>
                {selectedReport.properties.infrastructure_type.join(", ")}
              </div>
            </div>
            {selectedReport.properties.infrastructure_name && (
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Name</div>
                <div className={styles.fieldValue}>
                  {selectedReport.properties.infrastructure_name}
                </div>
              </div>
            )}
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Crisis</div>
              <div className={styles.fieldValue}>
                {selectedReport.properties.crisis_nature.join(", ")}
              </div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Submitted</div>
              <div className={styles.fieldValue}>
                {new Date(selectedReport.properties.submitted_at).toLocaleString()}
              </div>
            </div>
            <div className={styles.field}>
              <div className={styles.fieldLabel}>Versions</div>
              <div className={styles.fieldValue}>
                {selectedReport.properties.version_count} report(s) for this location
              </div>
            </div>
            {selectedReport.properties.location_description && (
              <div className={styles.field}>
                <div className={styles.fieldLabel}>Location</div>
                <div className={styles.fieldValue}>
                  {selectedReport.properties.location_description}
                </div>
              </div>
            )}
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
