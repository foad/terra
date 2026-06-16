import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "./components/layout";
import { ReportFlow } from "./components/report-flow";
import { FailedReportsPanel } from "./components/failed-reports-panel";
import { useGeolocation } from "./hooks/use-geolocation";
import { useConnectivity } from "./hooks/use-connectivity";
import { usePersistentStorage } from "./hooks/use-persistent-storage";
import { usePrefetchTiles } from "./hooks/use-prefetch-tiles";
import { useSync } from "./hooks/use-sync";
import styles from "./app.module.css";

export const App = () => {
  const { t } = useTranslation();
  const { latitude, longitude, accuracy, error } = useGeolocation();
  const { isOnline, isVerified, onReconnect } = useConnectivity();
  const storage = usePersistentStorage();
  const { counts } = useSync({ isOnline, isVerified }, onReconnect);
  usePrefetchTiles(latitude, longitude);

  const pendingCount = counts.pending + counts.syncing;
  const [showFailedPanel, setShowFailedPanel] = useState(false);

  // With a `?crisis=` deep link, location is optional (the crisis zone is
  // already known), so a denied/blocked geolocation isn't an error worth
  // alarming the reporter with (#228).
  const hasCrisisParam = useMemo(
    () => !!new URLSearchParams(window.location.search).get("crisis"),
    [],
  );

  return (
    <Layout>
      {error && !hasCrisisParam && (
        <div className={styles.errorBanner}>{error}</div>
      )}
      {!isOnline && (
        <div className={styles.warningBanner}>{t("app.offline")}</div>
      )}
      {storage.persisted === false && !isOnline && (
        <div className={styles.warningBanner}>{t("app.storageLimited")}</div>
      )}
      {pendingCount > 0 && isOnline && (
        <div className={styles.syncBanner}>
          {t("app.syncing", { count: pendingCount })}
        </div>
      )}
      {counts.failed > 0 && (
        <button
          type="button"
          className={styles.errorBannerBtn}
          onClick={() => setShowFailedPanel(true)}
        >
          {t("app.syncFailed", { count: counts.failed })}
          <span className={styles.errorBannerCaret}>›</span>
        </button>
      )}
      {showFailedPanel && (
        <FailedReportsPanel onClose={() => setShowFailedPanel(false)} />
      )}
      <ReportFlow
        latitude={latitude}
        longitude={longitude}
        accuracy={accuracy}
      />
    </Layout>
  );
};
