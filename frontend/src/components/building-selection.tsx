import type { SelectedBuilding } from "./map";
import styles from "./building-selection.module.css";

interface BuildingSelectionProps {
  building: SelectedBuilding | null;
  locationFallback: string;
  onLocationFallbackChange: (value: string) => void;
}

export const BuildingSelection = ({
  building,
  locationFallback,
  onLocationFallbackChange,
}: BuildingSelectionProps) => {
  return (
    <div className={styles.container}>
      {building ? (
        <div className={styles.selected}>
          <div className={styles.label}>Selected building</div>
          <div className={styles.details}>
            <span className={styles.area}>
              {Math.round(building.areaM2)} m²
            </span>
            <span className={styles.source}>{building.source}</span>
          </div>
          <div className={styles.coords}>
            {building.center[1].toFixed(5)}, {building.center[0].toFixed(5)}
          </div>
        </div>
      ) : (
        <div className={styles.unselected}>
          <div className={styles.label}>
            Tap a building on the map to select it
          </div>
          <div className={styles.fallback}>
            <label htmlFor="location-fallback">Or describe the location:</label>
            <input
              id="location-fallback"
              type="text"
              placeholder="e.g. The school near the central market"
              value={locationFallback}
              onChange={(e) => onLocationFallbackChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
