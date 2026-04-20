import { CircleCheck, CloudOff } from "lucide-react";
import styles from "./submission-confirmation.module.css";

interface SubmissionConfirmationProps {
  isOnline: boolean;
  onSubmitAnother: () => void;
}

export const SubmissionConfirmation = ({
  isOnline,
  onSubmitAnother,
}: SubmissionConfirmationProps) => {
  return (
    <div className={styles.container}>
      {isOnline ? (
        <CircleCheck size={56} className={styles.icon} />
      ) : (
        <CloudOff size={56} className={styles.iconQueued} />
      )}
      <h2 className={styles.title}>
        {isOnline ? "Report Submitted" : "Report Queued"}
      </h2>
      <p className={styles.message}>
        {isOnline
          ? "Thank you for your report. Your submission is helping response teams prioritise recovery efforts in your area."
          : "Your report has been saved and will be submitted automatically when connectivity returns."}
      </p>
      <a
        role="button"
        className="button button-primary button-without-arrow"
        onClick={onSubmitAnother}
      >
        Submit Another Report
      </a>
    </div>
  );
};
