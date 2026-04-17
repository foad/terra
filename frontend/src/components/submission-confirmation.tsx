import { CircleCheck } from "lucide-react";
import styles from "./submission-confirmation.module.css";

interface SubmissionConfirmationProps {
  areaReportCount: number;
  onSubmitAnother: () => void;
}

export const SubmissionConfirmation = ({
  areaReportCount,
  onSubmitAnother,
}: SubmissionConfirmationProps) => {
  return (
    <div className={styles.container}>
      <CircleCheck size={56} className={styles.icon} />
      <h2 className={styles.title}>Report Submitted</h2>
      <p className={styles.message}>
        Thank you for your report. Your submission is helping response teams
        prioritise recovery efforts in your area.
      </p>
      {areaReportCount > 1 && (
        <p className={styles.count}>
          {areaReportCount} reports have been submitted in your area.
        </p>
      )}
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
