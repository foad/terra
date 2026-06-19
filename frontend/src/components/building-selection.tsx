import { useTranslation } from "react-i18next";
import type { SelectedBuilding } from "./map";
import styles from "./building-selection.module.css";

interface BuildingSelectionProps {
  building: SelectedBuilding | null;
  manualPin: [number, number] | null;
  locationDescription?: string;
  onLocationDescriptionChange?: (value: string) => void;
}

export const BuildingSelection = ({
  building,
  manualPin,
  locationDescription,
  onLocationDescriptionChange,
}: BuildingSelectionProps) => {
  const { t } = useTranslation();

  if (building) {
    return (
      <div className={styles.container}>
        <div className={styles.selected}>
          <span className={styles.label}>{t("location.selectedBuilding")}</span>
          <span className={styles.area}>{Math.round(building.areaM2)} m²</span>
          <span className={styles.coords}>
            {building.center[1].toFixed(5)}, {building.center[0].toFixed(5)}
          </span>
        </div>
        {building.isPriority && (
          <div className={styles.priorityNotice}>
            {t("location.priorityHeading")}
          </div>
        )}
      </div>
    );
  }

  if (manualPin) {
    return (
      <div className={styles.container}>
        <div className={styles.selected}>
          <span className={styles.label}>{t("location.pinPlaced")}</span>
          <span className={styles.coords}>
            {manualPin[1].toFixed(5)}, {manualPin[0].toFixed(5)}
          </span>
        </div>
        {onLocationDescriptionChange && (
          <div className={styles.describeLocation}>
            <label
              className={styles.describeLabel}
              htmlFor="location-description"
            >
              {t("location.describeLabel")}
            </label>
            <input
              id="location-description"
              type="text"
              className={styles.describeInput}
              value={locationDescription ?? ""}
              placeholder={t("location.describePlaceholder")}
              maxLength={200}
              onChange={(e) => onLocationDescriptionChange(e.target.value)}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.unselected}>
        <div className={styles.label}>{t("location.selectBuilding")}</div>
        <div className={styles.hint}>{t("location.dropPinHint")}</div>
      </div>
    </div>
  );
};
