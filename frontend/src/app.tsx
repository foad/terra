import { useTranslation } from "react-i18next";
import { Layout } from "./components/layout";
import { ReportFlow } from "./components/report-flow";
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

  return (
    <Layout>
      {error && <div className={styles.errorBanner}>{error}</div>}
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
        <div className={styles.errorBanner}>
          {t("app.syncFailed", { count: counts.failed })}
        </div>
      )}
      <ReportFlow
        latitude={latitude}
        longitude={longitude}
        accuracy={accuracy}
      />
    </Layout>
  );
};
