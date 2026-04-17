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
import { SubmissionConfirmation } from "./submission-confirmation";
import { api } from "../utils/api";
import styles from "./report-flow.module.css";

type Step = "location" | "photo" | "damage" | "survey" | "submitting" | "confirmation";

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
  const [areaReportCount, setAreaReportCount] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleBuildingSelect = useCallback(
    (building: SelectedBuilding | null) => {
      setSelectedBuilding(building);
      if (building) setLocationFallback("");
    },
    [],
  );

  const handleSubmit = async () => {
    if (!damageLevel || !latitude || !longitude) return;

    setStep("submitting");
    setSubmitError(null);

    try {
      const result = await api("/reports", {
        method: "POST",
        body: JSON.stringify({
          latitude,
          longitude,
          s2_id: selectedBuilding?.s2Id ?? null,
          location_description: locationFallback || null,
          damage_level: damageLevel,
          photo_key: photo?.photoKey ?? null,
          infrastructure_type: survey.infrastructureType,
          infrastructure_type_other: survey.infrastructureTypeOther || null,
          infrastructure_name: survey.infrastructureName || null,
          crisis_nature: survey.crisisNature,
          debris_present: survey.debrisPresent,
          electricity_status: survey.electricityStatus || null,
          health_status: survey.healthStatus || null,
          pressing_needs: survey.pressingNeeds,
          pressing_needs_other: survey.pressingNeedsOther || null,
        }),
      });

      setAreaReportCount(result.area_report_count);
      setStep("confirmation");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
      setStep("survey");
      setSurveyStep(SURVEY_STEP_COUNT - 1);
    }
  };

  const handleSubmitAnother = () => {
    setStep("location");
    setSelectedBuilding(null);
    setLocationFallback("");
    setPhoto(null);
    setDamageLevel(null);
    setSurvey(EMPTY_SURVEY);
    setSurveyStep(0);
    setAreaReportCount(0);
    setSubmitError(null);
  };

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

  if (step === "survey" || step === "submitting") {
    const canAdvance = isSurveyStepComplete(surveyStep, survey);
    const isSubmitting = step === "submitting";

    const handleNext = () => {
      if (!canAdvance) return;
      if (isLastSurveyStep) {
        handleSubmit();
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
            className={`button button-secondary button-without-arrow ${isSubmitting ? "disabled" : ""}`}
            onClick={isSubmitting ? undefined : handleBack}
          >
            Back
          </a>
          <span className={styles.stepTitle}>
            Survey ({surveyStep + 1}/{SURVEY_STEP_COUNT})
          </span>
        </div>
        <SurveyForm step={surveyStep} value={survey} onChange={setSurvey} />
        {submitError && (
          <div className={styles.submitError}>{submitError}</div>
        )}
        <div className={styles.actions}>
          <a
            role="button"
            className={`button button-primary ${!canAdvance || isSubmitting ? "disabled" : ""}`}
            onClick={canAdvance && !isSubmitting ? handleNext : undefined}
          >
            {isSubmitting
              ? "Submitting..."
              : isLastSurveyStep
                ? "Submit Report"
                : "Next"}
          </a>
        </div>
      </div>
    );
  }

  if (step === "confirmation") {
    return (
      <div className={styles.step}>
        <SubmissionConfirmation
          areaReportCount={areaReportCount}
          onSubmitAnother={handleSubmitAnother}
        />
      </div>
    );
  }

  return null;
};
