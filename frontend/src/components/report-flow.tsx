import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Map } from "./map";
import type { SelectedBuilding } from "./map";
import { BuildingSelection } from "./building-selection";
import { ExistingReports } from "./existing-reports";
import { PhotoCapture } from "./photo-capture";
import type { PhotoResult } from "./photo-capture";
import { DamageClassification } from "./damage-classification";
import type { DamageLevel } from "./damage-classification";
import { SurveyForm } from "./survey-form";
import { CrisisQuestionsStep } from "./crisis-questions-step";
import {
  EMPTY_SURVEY,
  INFRASTRUCTURE_TYPES,
  SURVEY_STEP_COUNT,
  isSurveyStepComplete,
} from "./survey-data";
import type { PreSeeded, SurveyData } from "./survey-data";
import { SubmissionConfirmation } from "./submission-confirmation";
import { reportQueue } from "../utils/report-queue";
import { syncEngine } from "../utils/sync-engine";
import { api, isApiError } from "../utils/api";
import {
  loadSurveyPrefs,
  mergeEmptyFields,
  saveSurveyPrefs,
} from "../utils/survey-prefs";
import type { ReportFeature } from "../pages/dashboard";
import type { FollowUpQuestion } from "../utils/report-queue";
import styles from "./report-flow.module.css";

const AI_CONFIDENCE_THRESHOLD = 0.6;
const CLASSIFY_TIMEOUT_MS = 8000;

interface AiClassification {
  damageLevel: DamageLevel;
  damageConfidence: number;
  infrastructureType: string[];
  infrastructureConfidence: number;
}

type Step =
  | "location"
  | "photo"
  | "damage"
  | "survey"
  | "submitting"
  | "confirmation";

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
  const [manualPin, setManualPin] = useState<[number, number] | null>(null);
  const [locationDescription, setLocationDescription] = useState("");
  const [followUpAnswers, setFollowUpAnswers] = useState<
    Record<string, string>
  >({});
  const [photo, setPhoto] = useState<PhotoResult | null>(null);
  const [damageLevel, setDamageLevel] = useState<DamageLevel | null>(null);
  const [survey, setSurvey] = useState<SurveyData>(EMPTY_SURVEY);
  const [surveyStep, setSurveyStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [aiClassification, setAiClassification] =
    useState<AiClassification | null>(null);
  const classifiedKeyRef = useRef<string | null>(null);
  const [activeCrisisType, setActiveCrisisType] = useState<string | null>(null);
  const [activeCrisisFollowUpQuestions, setActiveCrisisFollowUpQuestions] =
    useState<FollowUpQuestion[]>([]);
  const [activeCrisisName, setActiveCrisisName] = useState<string | null>(null);
  const crisisLookedUpRef = useRef(false);
  // A `?crisis=<id>` deep link pins the flow to a specific crisis regardless
  // of the reporter's location — so evaluators (and Activation-Kit links) load
  // the right config without being in the zone (#228).
  const crisisIdParam = useMemo(
    () => new URLSearchParams(window.location.search).get("crisis"),
    [],
  );
  const [reportLocation, setReportLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [existingReports, setExistingReports] = useState<ReportFeature[]>([]);
  const [preSeeded, setPreSeeded] = useState<PreSeeded>({});

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

        if (
          classification.infrastructureConfidence >= AI_CONFIDENCE_THRESHOLD
        ) {
          const mapped = classification.infrastructureType
            .map(
              (key) => INFRASTRUCTURE_TYPES.find((t) => t.key === key)?.value,
            )
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
    aiClassification &&
    aiClassification.damageConfidence >= AI_CONFIDENCE_THRESHOLD
      ? aiClassification
      : null;
  const aiDamageSuggestion = aiDamageVisible?.damageLevel ?? null;
  const aiDamageConfidence = aiDamageVisible?.damageConfidence ?? null;

  const aiInfraVisible =
    aiClassification &&
    aiClassification.infrastructureConfidence >= AI_CONFIDENCE_THRESHOLD
      ? aiClassification
      : null;
  const aiInfraSuggestion = aiInfraVisible?.infrastructureType ?? null;
  const aiInfraConfidence = aiInfraVisible?.infrastructureConfidence ?? null;

  const handleBuildingSelect = useCallback(
    (building: SelectedBuilding | null) => {
      setSelectedBuilding(building);
      if (building) setManualPin(null);
      else setExistingReports([]);
    },
    [],
  );

  const handleManualPin = useCallback((coords: [number, number] | null) => {
    setManualPin(coords);
    setLocationDescription("");
    if (coords) setSelectedBuilding(null);
  }, []);

  useEffect(() => {
    if (crisisLookedUpRef.current) return;
    // The geolocation path needs a fix first; the `?crisis=` param path does not.
    if (!crisisIdParam && (latitude == null || longitude == null)) return;
    crisisLookedUpRef.current = true;

    const applyConfig = (config: {
      crisis_type?: string | null;
      follow_up_questions?: FollowUpQuestion[];
      name?: string | null;
    }) => {
      if (config.crisis_type) setActiveCrisisType(config.crisis_type);
      if (config.follow_up_questions)
        setActiveCrisisFollowUpQuestions(config.follow_up_questions);
      if (config.name) setActiveCrisisName(config.name);
      localStorage.setItem(
        "terra-crisis-config",
        JSON.stringify({
          crisis_type: config.crisis_type ?? null,
          follow_up_questions: config.follow_up_questions ?? [],
        }),
      );
    };

    (async () => {
      try {
        if (crisisIdParam) {
          // Match the crisis by id from the public list, so a deep link loads
          // the right config independent of the reporter's location (#228).
          const data = await api("/crisis-events");
          const match = (data?.events ?? []).find(
            (e: { id: string }) => e.id === crisisIdParam,
          );
          if (match) applyConfig(match);
          return;
        }
        const result = await api(
          `/crisis-events/active?lat=${latitude}&lng=${longitude}`,
        );
        if (result) applyConfig(result);
      } catch (err) {
        // A definitive HTTP response (404 = genuinely no active crisis at
        // this location) must not fall back to a stale cached crisis from
        // somewhere else — clear the cache instead.
        if (isApiError(err)) {
          localStorage.removeItem("terra-crisis-config");
          return;
        }
        // True network failure — fall back to the last cached crisis config
        // so offline reporters still get the configured questions.
        try {
          const cached = localStorage.getItem("terra-crisis-config");
          if (cached) {
            const config = JSON.parse(cached);
            if (config.crisis_type) setActiveCrisisType(config.crisis_type);
            if (Array.isArray(config.follow_up_questions)) {
              setActiveCrisisFollowUpQuestions(config.follow_up_questions);
            }
          }
        } catch {
          // Corrupt cache — ignore.
        }
      }
    })();
  }, [latitude, longitude, crisisIdParam]);

  useEffect(() => {
    const buildingId = selectedBuilding?.buildingId;
    if (!buildingId) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await api(
          `/reports/coverage?building_id=${encodeURIComponent(buildingId)}`,
        );
        if (!cancelled) setExistingReports(result?.features ?? []);
      } catch {
        if (!cancelled) setExistingReports([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedBuilding?.buildingId]);

  const handlePhotoCleared = useCallback(() => {
    setPhoto(null);
    setAiClassification(null);
    classifiedKeyRef.current = null;
  }, []);

  const handleAdvanceToSurvey = () => {
    const reportLat = selectedBuilding?.center[1] ?? manualPin?.[1] ?? latitude;
    const reportLng =
      selectedBuilding?.center[0] ?? manualPin?.[0] ?? longitude;
    const seeded: PreSeeded = {};
    setSurvey((prev) => {
      let next = prev;
      if (reportLat != null && reportLng != null) {
        const prefs = loadSurveyPrefs(reportLat, reportLng);
        if (prefs) {
          if (next.debrisPresent === null && prefs.debrisPresent !== null) {
            seeded.debrisPresent = prefs.debrisPresent;
          }
          if (!next.electricityStatus && prefs.electricityStatus) {
            seeded.electricityStatus = prefs.electricityStatus;
          }
          if (!next.healthStatus && prefs.healthStatus) {
            seeded.healthStatus = prefs.healthStatus;
          }
          if (
            next.pressingNeeds.length === 0 &&
            prefs.pressingNeeds.length > 0
          ) {
            seeded.pressingNeeds = prefs.pressingNeeds;
          }
          next = mergeEmptyFields(next, prefs);
        }
      }
      if (activeCrisisType && next.crisisNature.length === 0) {
        seeded.crisisNature = [activeCrisisType];
        next = { ...next, crisisNature: [activeCrisisType] };
      }
      return next;
    });
    setPreSeeded(seeded);
    setStep("survey");
  };

  const buildFollowUpResponses = (): Record<string, string> | null => {
    const responses: Record<string, string> = {};
    for (const [id, answer] of Object.entries(followUpAnswers)) {
      if (id === "location_description") continue; // system-reserved key
      const trimmed = answer.trim();
      // An "Other:" selection with no text entered is not an answer.
      if (trimmed && trimmed !== "Other:") responses[id] = trimmed;
    }
    if (!selectedBuilding && manualPin && locationDescription.trim()) {
      responses.location_description = locationDescription.trim();
    }
    return Object.keys(responses).length > 0 ? responses : null;
  };

  const handleSubmit = async () => {
    const reportLat = selectedBuilding?.center[1] ?? manualPin?.[1] ?? latitude;
    const reportLng =
      selectedBuilding?.center[0] ?? manualPin?.[0] ?? longitude;
    if (!damageLevel || reportLat == null || reportLng == null) return;

    setStep("submitting");
    setSubmitError(null);

    try {
      await reportQueue.add(
        {
          id: crypto.randomUUID(),
          photo: photo?.blob ? await photo.blob.arrayBuffer() : null,
          photoContentType: photo?.blob?.type ?? null,
          photoKey: photo?.photoKey ?? null,
          latitude: reportLat,
          longitude: reportLng,
          buildingId: selectedBuilding?.buildingId ?? null,
          damageLevel,
          aiDamageLevel: aiClassification?.damageLevel ?? null,
          aiInfrastructureType: aiClassification
            ? aiClassification.infrastructureType
                .map(
                  (key) =>
                    INFRASTRUCTURE_TYPES.find((t) => t.key === key)?.value,
                )
                .filter((v): v is string => Boolean(v))
            : null,
          aiConfidence: aiClassification?.damageConfidence ?? null,
          surveyData: { ...survey },
          followUpResponses: buildFollowUpResponses(),
          createdAt: new Date().toISOString(),
        },
        "pending",
      );

      saveSurveyPrefs(reportLat, reportLng, survey);
      setReportLocation({ lat: reportLat, lng: reportLng });
      syncEngine.processQueue();
      setStep("confirmation");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to queue report",
      );
      setStep("survey");
      setSurveyStep(SURVEY_STEP_COUNT - 1);
    }
  };

  const handleFollowUpComplete = async () => {
    setStep("location");
    setSelectedBuilding(null);
    setManualPin(null);
    setLocationDescription("");
    setFollowUpAnswers({});
    setPhoto(null);
    setDamageLevel(null);
    setSurvey(EMPTY_SURVEY);
    setSurveyStep(0);
    setSubmitError(null);
    setAiClassification(null);
    setReportLocation(null);
    classifiedKeyRef.current = null;
    setPreSeeded({});
  };

  const hasLocation = selectedBuilding !== null || manualPin !== null;

  // Crisis-configured questions render as one extra survey step (#51).
  const hasCrisisQuestions = activeCrisisFollowUpQuestions.length > 0;
  const totalSurveySteps = SURVEY_STEP_COUNT + (hasCrisisQuestions ? 1 : 0);
  const isLastSurveyStep = surveyStep === totalSurveySteps - 1;

  if (step === "location") {
    return (
      <div className={styles.step} data-testid="step-location">
        <div className={styles.mapContainer}>
          <Map
            latitude={latitude}
            longitude={longitude}
            accuracy={accuracy}
            pinnedCrisisId={crisisIdParam}
            onBuildingSelect={handleBuildingSelect}
            onManualPin={handleManualPin}
          />
          <div className={styles.locationOverlay}>
            <BuildingSelection
              building={selectedBuilding}
              manualPin={manualPin}
              locationDescription={locationDescription}
              onLocationDescriptionChange={setLocationDescription}
            />
            <ExistingReports reports={existingReports} />
          </div>
        </div>
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
        <PhotoCapture
          onPhotoUploaded={setPhoto}
          onPhotoCleared={handlePhotoCleared}
          existingPhoto={photo}
        />
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
            onClick={damageLevel ? handleAdvanceToSurvey : undefined}
          >
            {t("common.next")}
          </a>
        </div>
      </div>
    );
  }

  if (step === "survey" || step === "submitting") {
    // The crisis-questions step is optional by design — the core report is
    // never blocked on configured extras.
    const canAdvance =
      surveyStep >= SURVEY_STEP_COUNT ||
      isSurveyStepComplete(surveyStep, survey);
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
            {t("survey.title", {
              current: surveyStep + 1,
              total: totalSurveySteps,
            })}
          </span>
        </div>
        {surveyStep < SURVEY_STEP_COUNT ? (
          <SurveyForm
            step={surveyStep}
            value={survey}
            onChange={setSurvey}
            aiInfrastructure={aiInfraSuggestion}
            aiInfrastructureConfidence={aiInfraConfidence}
            preSeeded={preSeeded}
          />
        ) : (
          <CrisisQuestionsStep
            questions={activeCrisisFollowUpQuestions}
            responses={followUpAnswers}
            onChange={setFollowUpAnswers}
          />
        )}
        {submitError && <div className={styles.submitError}>{submitError}</div>}
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
    const infraKeys = survey.infrastructureType
      .map((v) => INFRASTRUCTURE_TYPES.find((t) => t.value === v)?.key)
      .filter((k): k is string => k !== undefined);
    return (
      <div className={styles.step} data-testid="step-confirmation">
        <SubmissionConfirmation
          isOnline={navigator.onLine}
          followUpQuestions={[]}
          onComplete={handleFollowUpComplete}
          infrastructureKeys={infraKeys}
          reportLat={reportLocation?.lat ?? null}
          reportLng={reportLocation?.lng ?? null}
          crisisName={activeCrisisName ?? undefined}
        />
      </div>
    );
  }

  return null;
};
