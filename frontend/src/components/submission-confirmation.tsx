import { useEffect, useState } from "react";
import { CircleCheck, CloudOff, Copy, Check, Shield, Share2 } from "lucide-react";
import { latLngToCell } from "h3-js";
import { OpenLocationCode } from "open-location-code";
import { useTranslation } from "react-i18next";
import { api } from "../utils/api";
import type { FollowUpQuestion } from "../utils/report-queue";
import styles from "./submission-confirmation.module.css";

const olc = new OpenLocationCode();

const CRITICAL_INFRA_KEYS = ["community", "utility", "government"];
const AREA_MILESTONE_THRESHOLD = 25;

interface SubmissionConfirmationProps {
  isOnline: boolean;
  followUpQuestions: FollowUpQuestion[];
  onComplete: (responses: Record<string, string> | null) => void;
  infrastructureKeys: string[];
  reportLat: number | null;
  reportLng: number | null;
  crisisName?: string;
}

export const SubmissionConfirmation = ({
  isOnline,
  followUpQuestions,
  onComplete,
  infrastructureKeys,
  reportLat,
  reportLng,
  crisisName,
}: SubmissionConfirmationProps) => {
  const { t } = useTranslation();
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [otherValues, setOtherValues] = useState<Record<string, string>>({});
  const [otherSelected, setOtherSelected] = useState<Record<string, boolean>>({});
  const [areaCount, setAreaCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const isCritical = infrastructureKeys.some((k) =>
    CRITICAL_INFRA_KEYS.includes(k),
  );

  const plusCode =
    reportLat != null && reportLng != null
      ? olc.encode(reportLat, reportLng)
      : null;

  const handleCopyPlusCode = async () => {
    if (!plusCode) return;
    try {
      await navigator.clipboard.writeText(plusCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available — silent
    }
  };

  useEffect(() => {
    if (!isOnline || reportLat == null || reportLng == null) return;
    let cancelled = false;
    (async () => {
      try {
        const h3Cell = latLngToCell(reportLat, reportLng, 8);
        const result = await api(`/reports?h3=${h3Cell}&limit=1`);
        if (!cancelled && typeof result?.total === "number") {
          setAreaCount(result.total);
        }
      } catch {
        // Area count is additive — silent drop on failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOnline, reportLat, reportLng]);

  const isMilestone =
    areaCount !== null && areaCount >= AREA_MILESTONE_THRESHOLD;

  const setResponse = (questionId: string, value: string) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
    setOtherSelected((prev) => ({ ...prev, [questionId]: false }));
  };

  const selectOther = (questionId: string) => {
    setOtherSelected((prev) => ({ ...prev, [questionId]: true }));
    const currentText = otherValues[questionId] ?? "";
    setResponses((prev) => ({ ...prev, [questionId]: `Other: ${currentText}` }));
  };

  const setOther = (questionId: string, value: string) => {
    setOtherValues((prev) => ({ ...prev, [questionId]: value }));
    setResponses((prev) => ({ ...prev, [questionId]: `Other: ${value}` }));
  };

  const handleComplete = () => {
    const hasEmptyOther = followUpQuestions.some(
      (q) => q.allow_other && (otherSelected[q.id] ?? false) && !otherValues[q.id]?.trim(),
    );
    if (hasEmptyOther) return;
    const finalResponses = Object.keys(responses).length > 0 ? responses : null;
    onComplete(finalResponses);
  };

  const handleShare = async () => {
    const url = window.location.href;
    const shareText = crisisName
      ? t("confirmation.shareTextWithCrisis", { crisisName })
      : t("confirmation.shareText");
    const shareData = {
      title: t("confirmation.shareTitle"),
      text: shareText,
      url,
    };
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch {
        // user dismissed the share sheet
      }
    } else {
      const encoded = encodeURIComponent(`${shareText}\n${url}`);
      window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener");
    }
  };

  const hasQuestions = followUpQuestions.length > 0;

  return (
    <div className={styles.container}>
      {isOnline ? (
        <CircleCheck size={56} className={styles.icon} />
      ) : (
        <CloudOff size={56} className={styles.iconQueued} />
      )}
      <h2 className={styles.title}>
        {isOnline ? t("confirmation.submitted") : t("confirmation.queued")}
      </h2>
      <p className={styles.message}>
        {isOnline
          ? t("confirmation.submittedMessage")
          : t("confirmation.queuedMessage")}
      </p>

      {isCritical && (
        <div className={styles.criticalBadge}>
          <Shield size={20} className={styles.criticalIcon} />
          <div>
            <div className={styles.criticalTitle}>
              {t("confirmation.criticalInfraTitle")}
            </div>
            <div className={styles.criticalMessage}>
              {t("confirmation.criticalInfraMessage")}
            </div>
          </div>
        </div>
      )}

      {areaCount !== null && (
        <p className={isMilestone ? styles.milestone : styles.areaCount}>
          {isMilestone
            ? t("confirmation.areaMilestone", { count: areaCount })
            : t("confirmation.areaCount", { count: areaCount })}
        </p>
      )}

      {plusCode && (
        <div className={styles.plusCode}>
          <span className={styles.plusCodeLabel}>
            {t("confirmation.plusCodeLabel")}
          </span>
          <div className={styles.plusCodeRow}>
            <code className={styles.plusCodeValue}>{plusCode}</code>
            <button
              type="button"
              className={styles.copyButton}
              onClick={handleCopyPlusCode}
              aria-label={t("confirmation.copyPlusCode")}
            >
              {copied ? (
                <Check size={16} className={styles.copyIconDone} />
              ) : (
                <Copy size={16} />
              )}
            </button>
          </div>
        </div>
      )}

      {hasQuestions && (
        <div className={styles.followUp}>
          <p className={styles.followUpHeading}>
            {t("confirmation.followUpHeading", { count: followUpQuestions.length })}
          </p>
          {followUpQuestions.map((q) => {
            const isOtherActive = otherSelected[q.id] ?? false;
            return (
              <div key={q.id} className={styles.question}>
                <p className={styles.questionText}>{q.question}</p>
                <div className={styles.options}>
                  {q.options.map((opt) => (
                    <label key={opt} className={styles.optionLabel}>
                      <input
                        type="radio"
                        name={q.id}
                        value={opt}
                        checked={!isOtherActive && responses[q.id] === opt}
                        onChange={() => setResponse(q.id, opt)}
                      />
                      {opt}
                    </label>
                  ))}
                  {q.allow_other && (
                    <label className={styles.optionLabel}>
                      <input
                        type="radio"
                        name={q.id}
                        value="__other__"
                        checked={isOtherActive}
                        onChange={() => selectOther(q.id)}
                      />
                      {t("confirmation.otherSpecify")}
                      {isOtherActive && (
                        <input
                          type="text"
                          className={styles.otherInput}
                          value={otherValues[q.id] ?? ""}
                          onChange={(e) => setOther(q.id, e.target.value)}
                          autoFocus
                        />
                      )}
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.buttonRow}>
        <button
          type="button"
          className={`button button-secondary button-without-arrow ${styles.shareButton}`}
          onClick={handleShare}
        >
          <Share2 size={16} />
          {t("confirmation.shareButton")}
        </button>
        <a
          role="button"
          className="button button-primary button-without-arrow"
          onClick={handleComplete}
        >
          {t("confirmation.submitAnother")}
        </a>
        {hasQuestions && (
          <button
            type="button"
            className={styles.skipButton}
            onClick={() => onComplete(null)}
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
};
