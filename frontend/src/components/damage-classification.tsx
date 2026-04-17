import styles from "./damage-classification.module.css";

export type DamageLevel = "minimal" | "partial" | "complete";

interface DamageOption {
  level: DamageLevel;
  label: string;
  description: string;
  icon: string;
}

const OPTIONS: DamageOption[] = [
  {
    level: "minimal",
    label: "Minimal / No damage",
    description:
      "Structurally sound and functional, showing only cosmetic or no visible damage",
    icon: "✓",
  },
  {
    level: "partial",
    label: "Partially damaged",
    description: "Repairable, and remains usable with caution",
    icon: "⚠",
  },
  {
    level: "complete",
    label: "Completely damaged",
    description: "Structurally unsafe or destroyed",
    icon: "✕",
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
  return (
    <div className={styles.container}>
      <div className={styles.label}>Damage level</div>
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
            >
              <div className={styles.cardIcon}>{option.icon}</div>
              <div className={styles.cardContent}>
                <div className={styles.cardLabel}>{option.label}</div>
                <div className={styles.cardDescription}>
                  {option.description}
                </div>
              </div>
              {isAiSuggested && aiConfidence != null && (
                <div className={styles.aiBadge}>
                  AI: {Math.round(aiConfidence * 100)}%
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
