import { useTranslation } from "react-i18next";
import type { FollowUpQuestion } from "../utils/report-queue";
import styles from "./survey-form.module.css";

interface CrisisQuestionsStepProps {
  questions: FollowUpQuestion[];
  responses: Record<string, string>;
  onChange: (responses: Record<string, string>) => void;
}

/** Crisis-configured questions rendered as the final survey step (#51).
 * Question text comes from the analyst's crisis configuration, not i18n —
 * see #153 for the content-translation pathway. Answers are optional: the
 * core report is never blocked on configured extras. */
export const CrisisQuestionsStep = ({
  questions,
  responses,
  onChange,
}: CrisisQuestionsStepProps) => {
  const { t } = useTranslation();

  const setResponse = (id: string, value: string) =>
    onChange({ ...responses, [id]: value });

  return (
    <div className={styles.container} data-testid="survey-step-crisis">
      {questions.map((q) => {
        const current = responses[q.id] ?? "";
        const isOther = current.startsWith("Other: ");
        return (
          <div key={q.id}>
            <h2 className={styles.question}>{q.question}</h2>
            <div className={styles.options}>
              {q.options.map((opt) => (
                <div className="form-check" key={opt}>
                  <input
                    type="radio"
                    id={`${q.id}-${opt}`}
                    name={q.id}
                    checked={current === opt}
                    onChange={() => setResponse(q.id, opt)}
                  />
                  <label htmlFor={`${q.id}-${opt}`}>{opt}</label>
                </div>
              ))}
              {q.allow_other && (
                <>
                  <div className="form-check">
                    <input
                      type="radio"
                      id={`${q.id}-other`}
                      name={q.id}
                      checked={isOther}
                      onChange={() => setResponse(q.id, "Other: ")}
                    />
                    <label htmlFor={`${q.id}-other`}>
                      {t("common.otherSpecify")}
                    </label>
                  </div>
                  {isOther && (
                    <input
                      type="text"
                      maxLength={200}
                      value={current.replace(/^Other: ?/, "")}
                      onChange={(e) =>
                        setResponse(q.id, `Other: ${e.target.value}`)
                      }
                    />
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
