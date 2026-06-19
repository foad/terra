import { CircleCheck, TriangleAlert, CircleX, Info } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import styles from "./damage-classification.module.css";

export type DamageLevel = "minimal" | "partial" | "complete";

interface DamageOption {
  level: DamageLevel;
  labelKey: string;
  descKey: string;
  icon: ReactNode;
}

const OPTIONS: DamageOption[] = [
  {
    level: "minimal",
    labelKey: "damage.minimal",
    descKey: "damage.minimalDesc",
    icon: <CircleCheck size={24} />,
  },
  {
    level: "partial",
    labelKey: "damage.partial",
    descKey: "damage.partialDesc",
    icon: <TriangleAlert size={24} />,
  },
  {
    level: "complete",
    labelKey: "damage.complete",
    descKey: "damage.completeDesc",
    icon: <CircleX size={24} />,
  },
];

interface DamageClassificationProps {
  value: DamageLevel | null;
  onChange: (level: DamageLevel) => void;
  aiSuggestion?: DamageLevel | null;
  aiConfidence?: number | null;
}

export const DamageClassification = ({
  value,
  onChange,
  aiSuggestion,
  aiConfidence,
}: DamageClassificationProps) => {
  const { t } = useTranslation();
  return (
    <div className={styles.container}>
      <div className={styles.label}>{t("damage.label")}</div>
      <div className={styles.options}>
        {OPTIONS.map((option) => {
          const isSelected = value === option.level;
          const isAiSuggested = aiSuggestion === option.level;

          return (
            <button
              key={option.level}
              type="button"
              className={`${styles.card} ${styles[option.level]} ${isSelected ? styles.selected : ""}`}
              onClick={() => onChange(option.level)}
              aria-pressed={isSelected}
              data-testid={`damage-${option.level}`}
            >
              <div className={styles.cardIcon}>{option.icon}</div>
              <div className={styles.cardContent}>
                <div className={styles.cardLabel}>{t(option.labelKey)}</div>
                <div className={styles.cardDescription}>
                  {t(option.descKey)}
                </div>
                {isAiSuggested && aiConfidence != null && (
                  <div className={styles.aiBadge}>
                    {t("common.aiConfidence", {
                      confidence: Math.round(aiConfidence * 100),
                    })}
                    <span
                      className={styles.aiInfoIcon}
                      title={t("common.aiConfidenceTooltip")}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info size={10} />
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
