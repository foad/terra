import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  return (
    <div className={styles.container}>
      {building ? (
        <div className={styles.selected}>
          <span className={styles.label}>{t("location.selectedBuilding")}</span>
          <span className={styles.area}>{Math.round(building.areaM2)} m²</span>
          <span className={styles.coords}>
            {building.center[1].toFixed(5)}, {building.center[0].toFixed(5)}
          </span>
        </div>
      ) : (
        <div className={styles.unselected}>
          <div className={styles.label}>{t("location.selectBuilding")}</div>
          <div className={styles.fallback}>
            <label htmlFor="location-fallback">
              {t("location.describeLocation")}
            </label>
            <input
              id="location-fallback"
              type="text"
              data-testid="input-location-fallback"
              placeholder={t("location.descriptionPlaceholder")}
              maxLength={500}
              value={locationFallback}
              onChange={(e) => onLocationFallbackChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
