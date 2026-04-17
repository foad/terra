import { Layout } from "./components/layout";
import { ReportFlow } from "./components/report-flow";
import { useGeolocation } from "./hooks/use-geolocation";
import styles from "./app.module.css";

export const App = () => {
  const { latitude, longitude, accuracy, error } = useGeolocation();

  return (
    <Layout>
      {error && <div className={styles.errorBanner}>{error}</div>}
      <ReportFlow
        latitude={latitude}
        longitude={longitude}
        accuracy={accuracy}
      />
    </Layout>
  );
};
