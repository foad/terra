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

const INFRASTRUCTURE_TYPES = [
  "Residential Infrastructure (Houses and apartments)",
  "Commercial Infrastructure (Markets, malls, shops, hotels, banks, industries, etc.)",
  "Government Building (Administrative buildings, courthouses, police stations, fire stations, etc.)",
  "Utility Infrastructure (Water pumps, power plants, waste treatment plants, etc.)",
  "Transport and Communication Infrastructure (Roads, cell towers, bridges, railway station, bus station, etc.)",
  "Community Infrastructure (Schools, hospitals, community halls, public toilets, etc.)",
  "Public spaces/Recreation Infrastructure (stadiums, playgrounds, religious buildings, etc.)",
];

const CRISIS_NATURES = [
  { group: "Natural hazards", options: ["Earthquake", "Flood", "Tsunami", "Hurricane/Cyclone", "Wildfire"] },
  { group: "Technological/industrial hazards", options: ["Explosion", "Chemical incident"] },
  { group: "Human-made crises", options: ["Conflict", "Civil unrest"] },
];

const ELECTRICITY_OPTIONS = [
  "No damage observed",
  "Minor damage (service disruptions but quickly repairable)",
  "Moderate damage (partial outages requiring repairs)",
  "Severe damage (major infrastructure damaged, prolonged outages)",
  "Completely destroyed (no electricity infrastructure functioning)",
  "Unknown/cannot be assessed",
];

const HEALTH_OPTIONS = [
  "Fully functional",
  "Partially functional",
  "Largely disrupted",
  "Not functioning at all",
  "Unknown",
];

const PRESSING_NEEDS = [
  "Food assistance and safe drinking water",
  "Cash or financial assistance",
  "Access to healthcare and essential medicines",
  "Shelter, housing repair, or temporary accommodation",
  "Restoration of livelihoods or income sources",
  "Water, sanitation, and hygiene (toilets, washing facilities)",
  "Restoration of basic services and infrastructure (electricity, roads, schools)",
  "Protection services and psychosocial support",
  "Support from local authorities and community organizations",
];

export const SURVEY_STEP_COUNT = 7;

export const isSurveyStepComplete = (step: number, data: SurveyData): boolean => {
  switch (step) {
    case 0: return data.infrastructureType.length > 0;
    case 1: return true; // name is optional
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
}

export const SurveyForm = ({ step, value, onChange }: SurveyFormProps) => {
  const toggleMultiSelect = (field: keyof SurveyData, option: string) => {
    const current = value[field] as string[];
    const updated = current.includes(option)
      ? current.filter((v) => v !== option)
      : [...current, option];
    onChange({ ...value, [field]: updated });
  };

  if (step === 0) {
    return (
      <div className={styles.container}>
        <h2 className={styles.question}>Type of infrastructure:</h2>
        <div className={styles.options}>
          {INFRASTRUCTURE_TYPES.map((type) => (
            <div className="form-check" key={type}>
              <input
                type="checkbox"
                id={`infra-${type}`}
                checked={value.infrastructureType.includes(type)}
                onChange={() => toggleMultiSelect("infrastructureType", type)}
              />
              <label htmlFor={`infra-${type}`}>{type}</label>
            </div>
          ))}
          <div className="form-check">
            <input
              type="checkbox"
              id="infra-other"
              checked={value.infrastructureType.includes("Other")}
              onChange={() => toggleMultiSelect("infrastructureType", "Other")}
            />
            <label htmlFor="infra-other">Other, please specify:</label>
          </div>
          {value.infrastructureType.includes("Other") && (
            <input
              type="text"
              placeholder="Specify other infrastructure type"
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
      <div className={styles.container}>
        <h2 className={styles.question}>
          Provide more details on the nature of the infrastructure, including the name of the infrastructure:
        </h2>
        <div className={styles.options}>
          <input
            type="text"
            id="infra-name"
            placeholder="e.g. Al-Noor Primary School"
            value={value.infrastructureName}
            onChange={(e) => onChange({ ...value, infrastructureName: e.target.value })}
          />
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className={styles.container}>
        <h2 className={styles.question}>Nature of the crisis:</h2>
        <div className={styles.options}>
          {CRISIS_NATURES.map((group) => (
            <div key={group.group} className={styles.optionGroup}>
              <div className={styles.optionGroupLabel}>{group.group}</div>
              {group.options.map((option) => (
                <div className="form-check" key={option}>
                  <input
                    type="checkbox"
                    id={`crisis-${option}`}
                    checked={value.crisisNature.includes(option)}
                    onChange={() => toggleMultiSelect("crisisNature", option)}
                  />
                  <label htmlFor={`crisis-${option}`}>{option}</label>
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
      <div className={styles.container}>
        <h2 className={styles.question}>
          Is there any debris that requires clearing on or near the infrastructure site?
        </h2>
        <div className={styles.options}>
          <div className="form-check">
            <input
              type="radio"
              id="debris-yes"
              name="debris"
              checked={value.debrisPresent === true}
              onChange={() => onChange({ ...value, debrisPresent: true })}
            />
            <label htmlFor="debris-yes">Yes</label>
          </div>
          <div className="form-check">
            <input
              type="radio"
              id="debris-no"
              name="debris"
              checked={value.debrisPresent === false}
              onChange={() => onChange({ ...value, debrisPresent: false })}
            />
            <label htmlFor="debris-no">No</label>
          </div>
        </div>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div className={styles.container}>
        <h2 className={styles.question}>
          What is the current condition of electricity infrastructure in your community following the crisis?
        </h2>
        <div className={styles.options}>
          {ELECTRICITY_OPTIONS.map((option) => (
            <div className="form-check" key={option}>
              <input
                type="radio"
                id={`elec-${option}`}
                name="electricity"
                checked={value.electricityStatus === option}
                onChange={() => onChange({ ...value, electricityStatus: option })}
              />
              <label htmlFor={`elec-${option}`}>{option}</label>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className={styles.container}>
        <h2 className={styles.question}>
          How would you rate the overall functioning of health services in your community since the event?
        </h2>
        <div className={styles.options}>
          {HEALTH_OPTIONS.map((option) => (
            <div className="form-check" key={option}>
              <input
                type="radio"
                id={`health-${option}`}
                name="health"
                checked={value.healthStatus === option}
                onChange={() => onChange({ ...value, healthStatus: option })}
              />
              <label htmlFor={`health-${option}`}>{option}</label>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === 6) {
    return (
      <div className={styles.container}>
        <h2 className={styles.question}>What are the most pressing needs?</h2>
        <div className={styles.options}>
          {PRESSING_NEEDS.map((need) => (
            <div className="form-check" key={need}>
              <input
                type="checkbox"
                id={`need-${need}`}
                checked={value.pressingNeeds.includes(need)}
                onChange={() => toggleMultiSelect("pressingNeeds", need)}
              />
              <label htmlFor={`need-${need}`}>{need}</label>
            </div>
          ))}
          <div className="form-check">
            <input
              type="checkbox"
              id="need-other"
              checked={value.pressingNeeds.includes("Other")}
              onChange={() => toggleMultiSelect("pressingNeeds", "Other")}
            />
            <label htmlFor="need-other">Other, please specify:</label>
          </div>
          {value.pressingNeeds.includes("Other") && (
            <input
              type="text"
              placeholder="Specify other pressing needs"
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
