import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { reportQueue } from "../utils/report-queue";
import { syncEngine } from "../utils/sync-engine";
import { DAMAGE_COLORS } from "./damage-colors";
import type { QueuedReport } from "../utils/report-queue";
import styles from "./failed-reports-panel.module.css";

interface Props {
  onClose: () => void;
}

export const FailedReportsPanel = ({ onClose }: Props) => {
  const { t } = useTranslation();
  const [reports, setReports] = useState<QueuedReport[]>([]);

  useEffect(() => {
    reportQueue.getByStatus("failed").then(setReports);
  }, []);

  const handleRetry = async (id: string) => {
    await reportQueue.updateStatus(id, "pending", {
      retryCount: 0,
      error: null,
    });
    setReports((prev) => prev.filter((r) => r.id !== id));
    syncEngine.processQueue();
  };

  const handleDiscard = async (id: string) => {
    await reportQueue.remove(id);
    setReports((prev) => prev.filter((r) => r.id !== id));
    await syncEngine.refreshCounts();
  };

  const handleRetryAll = async () => {
    for (const r of reports) {
      await reportQueue.updateStatus(r.id, "pending", {
        retryCount: 0,
        error: null,
      });
    }
    setReports([]);
    syncEngine.processQueue();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{t("app.failedPanelTitle")}</span>
          <div className={styles.headerActions}>
            {reports.length > 1 && (
              <button
                type="button"
                className={styles.retryAllBtn}
                onClick={handleRetryAll}
              >
                {t("app.failedPanelRetryAll")}
              </button>
            )}
            <button type="button" className={styles.closeBtn} onClick={onClose}>
              ×
            </button>
          </div>
        </div>

        <div className={styles.list}>
          {reports.length === 0 ? (
            <p className={styles.empty}>{t("app.failedPanelEmpty")}</p>
          ) : (
            reports.map((report) => (
              <div key={report.id} className={styles.card}>
                <div className={styles.cardMeta}>
                  <span
                    className={styles.damageChip}
                    style={{
                      background: DAMAGE_COLORS[report.damageLevel] ?? "#888",
                    }}
                  >
                    {report.damageLevel}
                  </span>
                  <span className={styles.date}>
                    {new Date(report.createdAt).toLocaleString()}
                  </span>
                </div>
                {report.error && <p className={styles.error}>{report.error}</p>}
                <div className={styles.cardActions}>
                  <a
                    role="button"
                    className={`button button-primary button-without-arrow ${styles.cardBtn}`}
                    onClick={() => handleRetry(report.id)}
                  >
                    {t("app.failedPanelRetry")}
                  </a>
                  <a
                    role="button"
                    className={`button button-secondary button-without-arrow ${styles.cardBtn}`}
                    onClick={() => handleDiscard(report.id)}
                  >
                    {t("app.failedPanelDiscard")}
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
