import { useState, useCallback } from "react";
import { Map } from "./map";
import type { SelectedBuilding } from "./map";
import { BuildingSelection } from "./building-selection";
import { PhotoCapture } from "./photo-capture";
import type { PhotoResult } from "./photo-capture";
import { DamageClassification } from "./damage-classification";
import type { DamageLevel } from "./damage-classification";
import {
  SurveyForm,
  EMPTY_SURVEY,
  SURVEY_STEP_COUNT,
  isSurveyStepComplete,
} from "./survey-form";
import type { SurveyData } from "./survey-form";
import styles from "./report-flow.module.css";

type Step = "location" | "photo" | "damage" | "survey";

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
  const [photo, setPhoto] = useState<PhotoResult | null>(null);
  const [damageLevel, setDamageLevel] = useState<DamageLevel | null>(null);
  const [survey, setSurvey] = useState<SurveyData>(EMPTY_SURVEY);
  const [surveyStep, setSurveyStep] = useState(0);

  const handleBuildingSelect = useCallback(
    (building: SelectedBuilding | null) => {
      setSelectedBuilding(building);
      if (building) setLocationFallback("");
    },
    [],
  );

  const hasLocation =
    selectedBuilding !== null || locationFallback.trim() !== "";

  const isLastSurveyStep = surveyStep === SURVEY_STEP_COUNT - 1;

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
        <div className={styles.actions}>
          <a
            role="button"
            className={`button button-primary ${!hasLocation ? "disabled" : ""}`}
            onClick={hasLocation ? () => setStep("photo") : undefined}
          >
            Next
          </a>
        </div>
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
        <PhotoCapture onPhotoUploaded={setPhoto} />
        <div className={styles.actions}>
          <a
            role="button"
            className={`button button-primary ${!photo ? "disabled" : ""}`}
            onClick={photo ? () => setStep("damage") : undefined}
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
        <div className={styles.actions}>
          <a
            role="button"
            className={`button button-primary ${!damageLevel ? "disabled" : ""}`}
            onClick={damageLevel ? () => setStep("survey") : undefined}
          >
            Next
          </a>
        </div>
      </div>
    );
  }

  if (step === "survey") {
    const canAdvance = isSurveyStepComplete(surveyStep, survey);

    const handleNext = () => {
      if (!canAdvance) return;
      if (isLastSurveyStep) {
        // Submit will be wired in #18
      } else {
        setSurveyStep(surveyStep + 1);
      }
    };

    const handleBack = () => {
      if (surveyStep > 0) {
        setSurveyStep(surveyStep - 1);
      } else {
        setStep("damage");
      }
    };

    return (
      <div className={styles.step}>
        <div className={styles.stepHeader}>
          <a
            role="button"
            className="button button-secondary button-without-arrow"
            onClick={handleBack}
          >
            Back
          </a>
          <span className={styles.stepTitle}>
            Survey ({surveyStep + 1}/{SURVEY_STEP_COUNT})
          </span>
        </div>
        <SurveyForm step={surveyStep} value={survey} onChange={setSurvey} />
        <div className={styles.actions}>
          <a
            role="button"
            className={`button button-primary ${!canAdvance ? "disabled" : ""}`}
            onClick={canAdvance ? handleNext : undefined}
          >
            {isLastSurveyStep ? "Submit Report" : "Next"}
          </a>
        </div>
      </div>
    );
  }

  return null;
};
