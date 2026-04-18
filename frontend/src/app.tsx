import { Layout } from "./components/layout";
import { ReportFlow } from "./components/report-flow";
import { useGeolocation } from "./hooks/use-geolocation";
import { usePersistentStorage } from "./hooks/use-persistent-storage";
import styles from "./app.module.css";

export const App = () => {
  const { latitude, longitude, accuracy, error } = useGeolocation();
  const storage = usePersistentStorage();

  return (
    <Layout>
      {error && <div className={styles.errorBanner}>{error}</div>}
      {storage.persisted === false && !navigator.onLine && (
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
