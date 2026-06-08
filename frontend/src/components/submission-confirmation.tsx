import { useState } from "react";
import { CircleCheck, CloudOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FollowUpQuestion } from "../utils/report-queue";
import styles from "./submission-confirmation.module.css";

interface SubmissionConfirmationProps {
  isOnline: boolean;
  followUpQuestions: FollowUpQuestion[];
  onComplete: (responses: Record<string, string> | null) => void;
}

export const SubmissionConfirmation = ({
  isOnline,
  followUpQuestions,
  onComplete,
}: SubmissionConfirmationProps) => {
  const { t } = useTranslation();
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [otherValues, setOtherValues] = useState<Record<string, string>>({});
  const [otherSelected, setOtherSelected] = useState<Record<string, boolean>>({});

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
