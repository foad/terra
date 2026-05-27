import { useTranslation } from "react-i18next";
import type { SelectedBuilding } from "./map";
import styles from "./building-selection.module.css";

interface BuildingSelectionProps {
  building: SelectedBuilding | null;
  manualPin: [number, number] | null;
}

export const BuildingSelection = ({
  building,
  manualPin,
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
