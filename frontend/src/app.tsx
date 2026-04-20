import { Layout } from "./components/layout";
import { ReportFlow } from "./components/report-flow";
import { useGeolocation } from "./hooks/use-geolocation";
import { useConnectivity } from "./hooks/use-connectivity";
import { usePersistentStorage } from "./hooks/use-persistent-storage";
import { usePrefetchTiles } from "./hooks/use-prefetch-tiles";
import { useSync } from "./hooks/use-sync";
import styles from "./app.module.css";

export const App = () => {
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
        <div className={styles.warningBanner}>
          You are offline. Reports will be queued and synced when connectivity returns.
        </div>
      )}
      {storage.persisted === false && !isOnline && (
        <div className={styles.warningBanner}>
          Offline storage may be limited. Reports queued offline could be lost
          if storage is full.
        </div>
      )}
      {pendingCount > 0 && isOnline && (
        <div className={styles.syncBanner}>
          Syncing {pendingCount} report{pendingCount !== 1 ? "s" : ""}...
        </div>
      )}
      {counts.failed > 0 && (
        <div className={styles.errorBanner}>
          {counts.failed} report{counts.failed !== 1 ? "s" : ""} failed to sync.
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
