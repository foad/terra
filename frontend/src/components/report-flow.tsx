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
import { reportQueue } from "../utils/report-queue";
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
      // Queue to IndexedDB — background sync handles the actual upload
      await reportQueue.add({
        id: crypto.randomUUID(),
        photo: photo?.blob ? await photo.blob.arrayBuffer() : null,
        photoContentType: photo?.blob?.type ?? null,
        photoKey: photo?.photoKey ?? null,
        latitude,
        longitude,
        s2Id: selectedBuilding?.s2Id ?? null,
        locationDescription: locationFallback || null,
        damageLevel,
        surveyData: { ...survey },
        createdAt: new Date().toISOString(),
      });

      setStep("confirmation");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to queue report");
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
    setSubmitError(null);
  };

  const hasLocation =
    selectedBuilding !== null || locationFallback.trim() !== "";

  const isLastSurveyStep = surveyStep === SURVEY_STEP_COUNT - 1;

  if (step === "location") {
    return (
      <div className={styles.step} data-testid="step-location">
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
            data-testid="btn-next"
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
      <div className={styles.step} data-testid="step-photo">
        <div className={styles.stepHeader}>
          <a
            role="button"
            data-testid="btn-back"
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
            data-testid="btn-next"
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
      <div className={styles.step} data-testid="step-damage">
        <div className={styles.stepHeader}>
          <a
            role="button"
            data-testid="btn-back"
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
            data-testid="btn-next"
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
      <div className={styles.step} data-testid="step-survey">
        <div className={styles.stepHeader}>
          <a
            role="button"
            data-testid="btn-back"
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
            data-testid={isLastSurveyStep ? "btn-submit" : "btn-next"}
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
      <div className={styles.step} data-testid="step-confirmation">
        <SubmissionConfirmation
          isOnline={navigator.onLine}
          onSubmitAnother={handleSubmitAnother}
        />
      </div>
    );
  }

  return null;
};
