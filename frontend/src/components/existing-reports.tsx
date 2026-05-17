import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReportFeature } from "../pages/dashboard";
import styles from "./existing-reports.module.css";

const DEFAULT_VISIBLE = 5;

interface ExistingReportsProps {
  reports: ReportFeature[];
}

export const ExistingReports = ({ reports }: ExistingReportsProps) => {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (reports.length === 0) return null;

  const latest = reports[0];
  const dtFmt = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const formatDateTime = (iso: string) => dtFmt.format(new Date(iso));

  const visible = reports.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = reports.length - visible.length;

  return (
    <div className={styles.card} data-testid="existing-reports">
      <div className={styles.title}>
        {t("location.existingReportsTitle", { count: reports.length })}
      </div>
      <div className={styles.latest}>
        {t("location.existingReportsLatest", {
          damage: t(`damage.${latest.properties.damage_level}`),
          date: formatDateTime(latest.properties.submitted_at),
        })}
      </div>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? t("location.hideExisting") : t("location.viewExisting")}
      </button>
      {expanded && (
        <ul className={styles.list}>
          {visible.map((r) => (
            <li key={r.properties.id} className={styles.item}>
              <span className={styles.itemDate}>
                {formatDateTime(r.properties.submitted_at)}
              </span>
              <span
                className={`${styles.itemDamage} ${styles[r.properties.damage_level]}`}
              >
                {t(`damage.${r.properties.damage_level}`)}
              </span>
              {r.properties.location_description && (
                <span className={styles.itemDescription}>
                  {r.properties.location_description}
                </span>
              )}
            </li>
          ))}
          {hiddenCount > 0 && (
            <li className={styles.itemMore}>
              {t("location.existingReportsMore", { count: hiddenCount })}
            </li>
          )}
        </ul>
      )}
    </div>
  );
};
