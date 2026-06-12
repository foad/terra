import { useState } from "react";
import { X } from "lucide-react";
import { api } from "../utils/api";
import type { ReportFeature } from "../pages/dashboard";
import styles from "./report-details-modal.module.css";

const DAMAGE_LEVELS = ["minimal", "partial", "complete"] as const;

interface ReportDetailsModalProps {
  report: ReportFeature;
  onClose: () => void;
  onReportUpdated: (updated: ReportFeature) => void;
}

export const ReportDetailsModal = ({
  report,
  onClose,
  onReportUpdated,
}: ReportDetailsModalProps) => {
  const p = report.properties;
  const photo = p.photo_url ?? p.thumbnail_url;
  const [saving, setSaving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const sendReview = async (patch: Record<string, string | null>) => {
    setSaving(true);
    setReviewError(null);
    try {
      const result = await api(`/reports/${p.id}/review`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      onReportUpdated({
        ...report,
        properties: {
          ...p,
          damage_level: result.damage_level,
          community_damage_level: result.community_damage_level,
          analyst_damage_level: result.analyst_damage_level,
          flag_status: result.flag_status,
          flag_reason: result.flag_reason,
        },
      });
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : "Failed to save review",
      );
    } finally {
      setSaving(false);
    }
  };

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
            {p.infrastructure_description && (
              <Field label="Description">{p.infrastructure_description}</Field>
            )}
            {p.follow_up_responses?.location_description && (
              <Field label="Location described as">
                {p.follow_up_responses.location_description}
              </Field>
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
            {p.follow_up_responses &&
              Object.keys(p.follow_up_responses).some(
                (k) => k !== "location_description",
              ) && (
              <Field label="Follow-up responses">
                <ul className={styles.followUpList}>
                  {Object.entries(p.follow_up_responses)
                    .filter(([key]) => key !== "location_description")
                    .map(([key, value]) => (
                      <li key={key}>{value}</li>
                    ))}
                </ul>
              </Field>
            )}
          </div>

          <div className={styles.review}>
            <div className={styles.reviewTitle}>Analyst review</div>

            {p.flag_status && (
              <div className={styles.flagBanner}>
                Flagged as {p.flag_status} — excluded from exports
                {p.flag_reason ? ` (${p.flag_reason})` : ""}
              </div>
            )}

            <div className={styles.reviewRow}>
              <span className={styles.reviewLabel}>Damage level</span>
              <div className={styles.reviewButtons}>
                {DAMAGE_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    disabled={saving}
                    className={`${styles.reviewBtn} ${
                      p.damage_level === level ? styles.reviewBtnActive : ""
                    }`}
                    onClick={() =>
                      sendReview({
                        analyst_damage_level:
                          level === p.community_damage_level ? null : level,
                      })
                    }
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
            {p.analyst_damage_level && (
              <div className={styles.reviewNote}>
                Reclassified by analyst — community reported "
                {p.community_damage_level}".{" "}
                <button
                  type="button"
                  disabled={saving}
                  className={styles.reviewLink}
                  onClick={() => sendReview({ analyst_damage_level: null })}
                >
                  Restore
                </button>
              </div>
            )}

            <div className={styles.reviewRow}>
              <span className={styles.reviewLabel}>Flag</span>
              <div className={styles.reviewButtons}>
                {p.flag_status ? (
                  <button
                    type="button"
                    disabled={saving}
                    className={styles.reviewBtn}
                    onClick={() => sendReview({ flag_status: null })}
                  >
                    Remove flag
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={saving}
                      className={styles.reviewBtn}
                      onClick={() => sendReview({ flag_status: "suspect" })}
                    >
                      Suspect
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      className={styles.reviewBtn}
                      onClick={() => sendReview({ flag_status: "invalid" })}
                    >
                      Invalid
                    </button>
                  </>
                )}
              </div>
            </div>

            {reviewError && (
              <div className={styles.reviewError}>{reviewError}</div>
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
