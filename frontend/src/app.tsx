import { useState, useCallback } from "react";
import { Layout } from "./components/layout";
import { Map } from "./components/map";
import type { SelectedBuilding } from "./components/map";
import { BuildingSelection } from "./components/building-selection";
import { useGeolocation } from "./hooks/use-geolocation";
import styles from "./app.module.css";

export const App = () => {
  const { latitude, longitude, accuracy, error } = useGeolocation();
  const [selectedBuilding, setSelectedBuilding] =
    useState<SelectedBuilding | null>(null);
  const [locationFallback, setLocationFallback] = useState("");

  const handleBuildingSelect = useCallback(
    (building: SelectedBuilding | null) => {
      setSelectedBuilding(building);
      if (building) setLocationFallback("");
    },
    [],
  );

  return (
    <Layout>
      {error && <div className={styles.errorBanner}>{error}</div>}
      <Map
        latitude={latitude}
        longitude={longitude}
        accuracy={accuracy}
        onBuildingSelect={handleBuildingSelect}
      />
      <BuildingSelection
        building={selectedBuilding}
        locationFallback={locationFallback}
        onLocationFallbackChange={setLocationFallback}
      />
    </Layout>
  );
};
