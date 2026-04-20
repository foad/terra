import { CircleCheck, CloudOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import styles from "./submission-confirmation.module.css";

interface SubmissionConfirmationProps {
  isOnline: boolean;
  onSubmitAnother: () => void;
}

export const SubmissionConfirmation = ({
  isOnline,
  onSubmitAnother,
}: SubmissionConfirmationProps) => {
  const { t } = useTranslation();
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
      <a
        role="button"
        className="button button-primary button-without-arrow"
        onClick={onSubmitAnother}
      >
        {t("confirmation.submitAnother")}
      </a>
    </div>
  );
};
