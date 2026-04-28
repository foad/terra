import { useTranslation } from "react-i18next";
import styles from "./survey-form.module.css";

export interface SurveyData {
  infrastructureType: string[];
  infrastructureTypeOther: string;
  infrastructureName: string;
  crisisNature: string[];
  debrisPresent: boolean | null;
  electricityStatus: string;
  healthStatus: string;
  pressingNeeds: string[];
  pressingNeedsOther: string;
}

export const EMPTY_SURVEY: SurveyData = {
  infrastructureType: [],
  infrastructureTypeOther: "",
  infrastructureName: "",
  crisisNature: [],
  debrisPresent: null,
  electricityStatus: "",
  healthStatus: "",
  pressingNeeds: [],
  pressingNeedsOther: "",
};

// Values stored in the database (always English)
export const INFRASTRUCTURE_TYPES = [
  { key: "residential", value: "Residential Infrastructure (Houses and apartments)" },
  { key: "commercial", value: "Commercial Infrastructure (Markets, malls, shops, hotels, banks, industries, etc.)" },
  { key: "government", value: "Government Building (Administrative buildings, courthouses, police stations, fire stations, etc.)" },
  { key: "utility", value: "Utility Infrastructure (Water pumps, power plants, waste treatment plants, etc.)" },
  { key: "transport", value: "Transport and Communication Infrastructure (Roads, cell towers, bridges, railway station, bus station, etc.)" },
  { key: "community", value: "Community Infrastructure (Schools, hospitals, community halls, public toilets, etc.)" },
  { key: "publicSpaces", value: "Public spaces/Recreation Infrastructure (stadiums, playgrounds, religious buildings, etc.)" },
];

const CRISIS_GROUPS = [
  { key: "natural", types: [
    { key: "earthquake", value: "Earthquake" },
    { key: "flood", value: "Flood" },
    { key: "tsunami", value: "Tsunami" },
    { key: "hurricane", value: "Hurricane/Cyclone" },
    { key: "wildfire", value: "Wildfire" },
  ]},
  { key: "technological", types: [
    { key: "explosion", value: "Explosion" },
    { key: "chemical", value: "Chemical incident" },
  ]},
  { key: "humanMade", types: [
    { key: "conflict", value: "Conflict" },
    { key: "civilUnrest", value: "Civil unrest" },
  ]},
];

const ELECTRICITY_OPTIONS = [
  { key: "none", value: "No damage observed" },
  { key: "minor", value: "Minor damage (service disruptions but quickly repairable)" },
  { key: "moderate", value: "Moderate damage (partial outages requiring repairs)" },
  { key: "severe", value: "Severe damage (major infrastructure damaged, prolonged outages)" },
  { key: "destroyed", value: "Completely destroyed (no electricity infrastructure functioning)" },
  { key: "unknown", value: "Unknown/cannot be assessed" },
];

const HEALTH_OPTIONS = [
  { key: "functional", value: "Fully functional" },
  { key: "partial", value: "Partially functional" },
  { key: "disrupted", value: "Largely disrupted" },
  { key: "notFunctioning", value: "Not functioning at all" },
  { key: "unknown", value: "Unknown" },
];

const PRESSING_NEEDS = [
  { key: "food", value: "Food assistance and safe drinking water" },
  { key: "cash", value: "Cash or financial assistance" },
  { key: "healthcare", value: "Access to healthcare and essential medicines" },
  { key: "shelter", value: "Shelter, housing repair, or temporary accommodation" },
  { key: "livelihoods", value: "Restoration of livelihoods or income sources" },
  { key: "wash", value: "Water, sanitation, and hygiene (toilets, washing facilities)" },
  { key: "services", value: "Restoration of basic services and infrastructure (electricity, roads, schools)" },
  { key: "protection", value: "Protection services and psychosocial support" },
  { key: "localSupport", value: "Support from local authorities and community organizations" },
];

export const SURVEY_STEP_COUNT = 7;

export const isSurveyStepComplete = (step: number, data: SurveyData): boolean => {
  switch (step) {
    case 0: return data.infrastructureType.length > 0;
    case 1: return true;
    case 2: return data.crisisNature.length > 0;
    case 3: return data.debrisPresent !== null;
    case 4: return data.electricityStatus !== "";
    case 5: return data.healthStatus !== "";
    case 6: return data.pressingNeeds.length > 0;
    default: return false;
  }
};

interface SurveyFormProps {
  step: number;
  value: SurveyData;
  onChange: (data: SurveyData) => void;
  aiInfrastructure?: string[] | null;
  aiInfrastructureConfidence?: number | null;
}

export const SurveyForm = ({
  step,
  value,
  onChange,
  aiInfrastructure,
  aiInfrastructureConfidence,
}: SurveyFormProps) => {
  const { t } = useTranslation();
  const aiInfraBadge =
    aiInfrastructure && aiInfrastructureConfidence != null
      ? t("common.aiConfidence", {
          confidence: Math.round(aiInfrastructureConfidence * 100),
        })
      : null;

  const toggleMultiSelect = (field: keyof SurveyData, option: string) => {
    const current = value[field] as string[];
    const updated = current.includes(option)
      ? current.filter((v) => v !== option)
      : [...current, option];
    onChange({ ...value, [field]: updated });
  };

  if (step === 0) {
    return (
      <div className={styles.container} data-testid="survey-step-0">
        <h2 className={styles.question}>{t("survey.infrastructureType")}</h2>
        <div className={styles.options}>
          {INFRASTRUCTURE_TYPES.map((type) => {
            const isAiSuggested = aiInfrastructure?.includes(type.key) ?? false;
            return (
              <div className="form-check" key={type.key}>
                <input
                  type="checkbox"
                  id={`infra-${type.value}`}
                  checked={value.infrastructureType.includes(type.value)}
                  onChange={() => toggleMultiSelect("infrastructureType", type.value)}
                />
                <label htmlFor={`infra-${type.value}`} className={styles.checkLabel}>
                  <span>{t(`survey.infrastructureTypes.${type.key}`)}</span>
                  {isAiSuggested && aiInfraBadge && (
                    <span className={styles.aiBadge}>{aiInfraBadge}</span>
                  )}
                </label>
              </div>
            );
          })}
          <div className="form-check">
            <input
              type="checkbox"
              id="infra-other"
              checked={value.infrastructureType.includes("Other")}
              onChange={() => toggleMultiSelect("infrastructureType", "Other")}
            />
            <label htmlFor="infra-other">{t("common.otherSpecify")}</label>
          </div>
          {value.infrastructureType.includes("Other") && (
            <input
              type="text"
              value={value.infrastructureTypeOther}
              onChange={(e) => onChange({ ...value, infrastructureTypeOther: e.target.value })}
            />
          )}
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className={styles.container} data-testid="survey-step-1">
        <h2 className={styles.question}>{t("survey.infrastructureDetails")}</h2>
        <div className={styles.options}>
          <input
            type="text"
            id="infra-name"
            placeholder={t("survey.infrastructureNamePlaceholder")}
            value={value.infrastructureName}
            onChange={(e) => onChange({ ...value, infrastructureName: e.target.value })}
          />
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className={styles.container} data-testid="survey-step-2">
        <h2 className={styles.question}>{t("survey.crisisNature")}</h2>
        <div className={styles.options}>
          {CRISIS_GROUPS.map((group) => (
            <div key={group.key} className={styles.optionGroup}>
              <div className={styles.optionGroupLabel}>
                {t(`survey.crisisGroups.${group.key}`)}
              </div>
              {group.types.map((type) => (
                <div className="form-check" key={type.key}>
                  <input
                    type="checkbox"
                    id={`crisis-${type.value}`}
                    checked={value.crisisNature.includes(type.value)}
                    onChange={() => toggleMultiSelect("crisisNature", type.value)}
                  />
                  <label htmlFor={`crisis-${type.value}`}>
                    {t(`survey.crisisTypes.${type.key}`)}
                  </label>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className={styles.container} data-testid="survey-step-3">
        <h2 className={styles.question}>{t("survey.debris")}</h2>
        <div className={styles.options}>
          <div className="form-check">
            <input
              type="radio"
              id="debris-yes"
              name="debris"
              checked={value.debrisPresent === true}
              onChange={() => onChange({ ...value, debrisPresent: true })}
            />
            <label htmlFor="debris-yes">{t("common.yes")}</label>
          </div>
          <div className="form-check">
            <input
              type="radio"
              id="debris-no"
              name="debris"
              checked={value.debrisPresent === false}
              onChange={() => onChange({ ...value, debrisPresent: false })}
            />
            <label htmlFor="debris-no">{t("common.no")}</label>
          </div>
        </div>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className={styles.container} data-testid="survey-step-4">
        <h2 className={styles.question}>{t("survey.electricity")}</h2>
        <div className={styles.options}>
          {ELECTRICITY_OPTIONS.map((option) => (
            <div className="form-check" key={option.key}>
              <input
                type="radio"
                id={`elec-${option.value}`}
                name="electricity"
                checked={value.electricityStatus === option.value}
                onChange={() => onChange({ ...value, electricityStatus: option.value })}
              />
              <label htmlFor={`elec-${option.value}`}>
                {t(`survey.electricityOptions.${option.key}`)}
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className={styles.container} data-testid="survey-step-5">
        <h2 className={styles.question}>{t("survey.health")}</h2>
        <div className={styles.options}>
          {HEALTH_OPTIONS.map((option) => (
            <div className="form-check" key={option.key}>
              <input
                type="radio"
                id={`health-${option.value}`}
                name="health"
                checked={value.healthStatus === option.value}
                onChange={() => onChange({ ...value, healthStatus: option.value })}
              />
              <label htmlFor={`health-${option.value}`}>
                {t(`survey.healthOptions.${option.key}`)}
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === 6) {
    return (
      <div className={styles.container} data-testid="survey-step-6">
        <h2 className={styles.question}>{t("survey.pressingNeeds")}</h2>
        <div className={styles.options}>
          {PRESSING_NEEDS.map((need) => (
            <div className="form-check" key={need.key}>
              <input
                type="checkbox"
                id={`need-${need.value}`}
                checked={value.pressingNeeds.includes(need.value)}
                onChange={() => toggleMultiSelect("pressingNeeds", need.value)}
              />
              <label htmlFor={`need-${need.value}`}>
                {t(`survey.pressingNeedOptions.${need.key}`)}
              </label>
            </div>
          ))}
          <div className="form-check">
            <input
              type="checkbox"
              id="need-other"
              checked={value.pressingNeeds.includes("Other")}
              onChange={() => toggleMultiSelect("pressingNeeds", "Other")}
            />
            <label htmlFor="need-other">{t("common.otherSpecify")}</label>
          </div>
          {value.pressingNeeds.includes("Other") && (
            <input
              type="text"
              value={value.pressingNeedsOther}
              onChange={(e) => onChange({ ...value, pressingNeedsOther: e.target.value })}
            />
          )}
        </div>
      </div>
    );
  }

  return null;
};
