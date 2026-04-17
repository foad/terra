import { useState, useCallback } from "react";
import { Map } from "./map";
import type { SelectedBuilding } from "./map";
import { BuildingSelection } from "./building-selection";
import { DamageClassification } from "./damage-classification";
import type { DamageLevel } from "./damage-classification";
import styles from "./report-flow.module.css";

type Step = "location" | "photo" | "damage";

interface ReportFlowProps {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
}

export const ReportFlow = ({
  latitude,
  longitude,
  accuracy,
}: ReportFlowProps) => {
  const [step, setStep] = useState<Step>("location");
  const [selectedBuilding, setSelectedBuilding] =
    useState<SelectedBuilding | null>(null);
  const [locationFallback, setLocationFallback] = useState("");
  const [damageLevel, setDamageLevel] = useState<DamageLevel | null>(null);

  const handleBuildingSelect = useCallback(
    (building: SelectedBuilding | null) => {
      setSelectedBuilding(building);
      if (building) setLocationFallback("");
    },
    [],
  );

  const hasLocation =
    selectedBuilding !== null || locationFallback.trim() !== "";

  if (step === "location") {
    return (
      <div className={styles.step}>
        <div className={styles.mapContainer}>
          <Map
            latitude={latitude}
            longitude={longitude}
            accuracy={accuracy}
            onBuildingSelect={handleBuildingSelect}
          />
        </div>
        <BuildingSelection
          building={selectedBuilding}
          locationFallback={locationFallback}
          onLocationFallbackChange={setLocationFallback}
        />
        {hasLocation && (
          <div className={styles.actions}>
            <a
              role="button"
              className="button button-primary"
              onClick={() => setStep("photo")}
            >
              Next
            </a>
          </div>
        )}
      </div>
    );
  }

  if (step === "photo") {
    return (
      <div className={styles.step}>
        <div className={styles.stepHeader}>
          <a
            role="button"
            className="button button-secondary button-without-arrow"
            onClick={() => setStep("location")}
          >
            Back
          </a>
          <span className={styles.stepTitle}>Take a Photo</span>
        </div>
        {/* Photo capture component will be added in #26 */}
        <div className={styles.placeholder}>Photo capture coming soon</div>
        <div className={styles.actions}>
          <a
            role="button"
            className="button button-primary"
            onClick={() => setStep("damage")}
          >
            Next
          </a>
        </div>
      </div>
    );
  }

  if (step === "damage") {
    return (
      <div className={styles.step}>
        <div className={styles.stepHeader}>
          <a
            role="button"
            className="button button-secondary button-without-arrow"
            onClick={() => setStep("photo")}
          >
            Back
          </a>
          <span className={styles.stepTitle}>Damage Assessment</span>
        </div>
        <DamageClassification value={damageLevel} onChange={setDamageLevel} />
        {damageLevel && (
          <div className={styles.actions}>
            <a
              role="button"
              className="button button-primary"
              onClick={() => {
                // Next steps will be added as we build more tickets
              }}
            >
              Next
            </a>
          </div>
        )}
      </div>
    );
  }

  return null;
};
