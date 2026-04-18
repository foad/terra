import { Layout } from "./components/layout";
import { ReportFlow } from "./components/report-flow";
import { useGeolocation } from "./hooks/use-geolocation";
import { useConnectivity } from "./hooks/use-connectivity";
import { usePersistentStorage } from "./hooks/use-persistent-storage";
import { usePrefetchTiles } from "./hooks/use-prefetch-tiles";
import styles from "./app.module.css";

export const App = () => {
  const { latitude, longitude, accuracy, error } = useGeolocation();
  const connectivity = useConnectivity();
  const storage = usePersistentStorage();
  usePrefetchTiles(latitude, longitude);

  return (
    <Layout>
      {error && <div className={styles.errorBanner}>{error}</div>}
      {!connectivity.isOnline && (
        <div className={styles.warningBanner}>
          You are offline. Reports will be queued and synced when connectivity returns.
        </div>
      )}
      {storage.persisted === false && !connectivity.isOnline && (
        <div className={styles.warningBanner}>
          Offline storage may be limited. Reports queued offline could be lost
          if storage is full.
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
