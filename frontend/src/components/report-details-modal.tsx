import { X } from "lucide-react";
import type { ReportFeature } from "../pages/dashboard";
import styles from "./report-details-modal.module.css";

interface ReportDetailsModalProps {
  report: ReportFeature;
  onClose: () => void;
}

export const ReportDetailsModal = ({
  report,
  onClose,
}: ReportDetailsModalProps) => {
  const p = report.properties;
  const photo = p.photo_url ?? p.thumbnail_url;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Report details</h2>
          <button type="button" className={styles.close} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className={styles.body}>
          {photo && <img src={photo} alt="" className={styles.photo} />}
          <div className={styles.fields}>
            <Field label="Submitted">
              {new Date(p.submitted_at).toLocaleString()}
            </Field>
            <Field label="Damage level">
              <span
                className={`${styles.damageBadge} ${styles[p.damage_level]}`}
              >
                {p.damage_level}
              </span>
            </Field>
            <Field label="Infrastructure">
              {p.infrastructure_type.join(", ")}
            </Field>
            {p.infrastructure_name && (
              <Field label="Name">{p.infrastructure_name}</Field>
            )}
            <Field label="Crisis">{p.crisis_nature.join(", ")}</Field>
            {p.debris_present !== null && (
              <Field label="Debris">{p.debris_present ? "Yes" : "No"}</Field>
            )}
            {p.electricity_status && (
              <Field label="Electricity">{p.electricity_status}</Field>
            )}
            {p.health_status && (
              <Field label="Health services">{p.health_status}</Field>
            )}
            {p.pressing_needs.length > 0 && (
              <Field label="Pressing needs">
                {p.pressing_needs.join(", ")}
              </Field>
            )}
            {p.location_description && (
              <Field label="Location">{p.location_description}</Field>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className={styles.field}>
    <div className={styles.fieldLabel}>{label}</div>
    <div className={styles.fieldValue}>{children}</div>
  </div>
);
