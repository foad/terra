import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
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
  INFRASTRUCTURE_TYPES,
} from "./survey-form";
import type { SurveyData } from "./survey-form";
import { SubmissionConfirmation } from "./submission-confirmation";
import { reportQueue } from "../utils/report-queue";
import { api } from "../utils/api";
import styles from "./report-flow.module.css";

const AI_CONFIDENCE_THRESHOLD = 0.6;
const CLASSIFY_TIMEOUT_MS = 8000;

interface AiClassification {
  damageLevel: DamageLevel;
  damageConfidence: number;
  infrastructureType: string[];
  infrastructureConfidence: number;
}

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
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("location");
  const [selectedBuilding, setSelectedBuilding] =
    useState<SelectedBuilding | null>(null);
  const [locationFallback, setLocationFallback] = useState("");
  const [photo, setPhoto] = useState<PhotoResult | null>(null);
  const [damageLevel, setDamageLevel] = useState<DamageLevel | null>(null);
  const [survey, setSurvey] = useState<SurveyData>(EMPTY_SURVEY);
  const [surveyStep, setSurveyStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [aiClassification, setAiClassification] = useState<AiClassification | null>(null);
  const classifiedKeyRef = useRef<string | null>(null);

  // Fire classification as soon as the photo has been uploaded. Non-blocking:
  // the user can complete the flow whether or not it succeeds. The pre-select
  // for infrastructure type runs in the same async callback so we never
  // synchronously setState from an effect body.
  useEffect(() => {
    const photoKey = photo?.photoKey;
    if (!photoKey || classifiedKeyRef.current === photoKey) return;
    classifiedKeyRef.current = photoKey;

    (async () => {
      try {
        const result = await api(`/photos/classify`, {
          method: "POST",
          body: JSON.stringify({ photo_key: photoKey }),
          timeout: CLASSIFY_TIMEOUT_MS,
        });
        const classification: AiClassification = {
          damageLevel: result.damage_level,
          damageConfidence: result.damage_confidence,
          infrastructureType: result.infrastructure_type,
          infrastructureConfidence: result.infrastructure_confidence,
        };
        setAiClassification(classification);

        if (classification.damageConfidence >= AI_CONFIDENCE_THRESHOLD) {
          setDamageLevel((prev) => prev ?? classification.damageLevel);
        }

        if (classification.infrastructureConfidence >= AI_CONFIDENCE_THRESHOLD) {
          const mapped = classification.infrastructureType
            .map((key) => INFRASTRUCTURE_TYPES.find((t) => t.key === key)?.value)
            .filter((v): v is string => Boolean(v));
          if (mapped.length > 0) {
            setSurvey((prev) =>
              prev.infrastructureType.length > 0
                ? prev
                : { ...prev, infrastructureType: mapped },
            );
          }
        }
      } catch {
        // Silent drop — AI is purely additive.
      }
    })();
  }, [photo?.photoKey]);

  const aiDamageVisible =
    aiClassification && aiClassification.damageConfidence >= AI_CONFIDENCE_THRESHOLD
      ? aiClassification
      : null;
  const aiDamageSuggestion = aiDamageVisible?.damageLevel ?? null;
  const aiDamageConfidence = aiDamageVisible?.damageConfidence ?? null;

  const aiInfraVisible =
    aiClassification && aiClassification.infrastructureConfidence >= AI_CONFIDENCE_THRESHOLD
      ? aiClassification
      : null;
  const aiInfraSuggestion = aiInfraVisible?.infrastructureType ?? null;
  const aiInfraConfidence = aiInfraVisible?.infrastructureConfidence ?? null;

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
        aiDamageLevel: aiClassification?.damageLevel ?? null,
        aiInfrastructureType: aiClassification
          ? aiClassification.infrastructureType
              .map((key) => INFRASTRUCTURE_TYPES.find((t) => t.key === key)?.value)
              .filter((v): v is string => Boolean(v))
          : null,
        aiConfidence: aiClassification?.damageConfidence ?? null,
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
    setAiClassification(null);
    classifiedKeyRef.current = null;
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
            {t("common.next")}
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
            {t("common.back")}
          </a>
          <span className={styles.stepTitle}>{t("photo.title")}</span>
        </div>
        <PhotoCapture onPhotoUploaded={setPhoto} existingPhoto={photo} />
        <div className={styles.actions}>
          <a
            role="button"
            data-testid="btn-next"
            className={`button button-primary ${!photo ? "disabled" : ""}`}
            onClick={photo ? () => setStep("damage") : undefined}
          >
            {t("common.next")}
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
            {t("common.back")}
          </a>
          <span className={styles.stepTitle}>{t("damage.title")}</span>
        </div>
        <DamageClassification
          value={damageLevel}
          onChange={setDamageLevel}
          aiSuggestion={aiDamageSuggestion}
          aiConfidence={aiDamageConfidence}
        />
        <div className={styles.actions}>
          <a
            role="button"
            data-testid="btn-next"
            className={`button button-primary ${!damageLevel ? "disabled" : ""}`}
            onClick={damageLevel ? () => setStep("survey") : undefined}
          >
            {t("common.next")}
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
            {t("common.back")}
          </a>
          <span className={styles.stepTitle}>
            {t("survey.title", { current: surveyStep + 1, total: SURVEY_STEP_COUNT })}
          </span>
        </div>
        <SurveyForm
          step={surveyStep}
          value={survey}
          onChange={setSurvey}
          aiInfrastructure={aiInfraSuggestion}
          aiInfrastructureConfidence={aiInfraConfidence}
        />
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
              ? t("common.submitting")
              : isLastSurveyStep
                ? t("common.submit")
                : t("common.next")}
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
