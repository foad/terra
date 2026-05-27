export interface SurveyData {
  infrastructureType: string[];
  infrastructureTypeOther: string;
  infrastructureDescription: string;
  crisisNature: string[];
  debrisPresent: boolean | null;
  electricityStatus: string;
  healthStatus: string;
  pressingNeeds: string[];
  pressingNeedsOther: string;
}

export interface PreSeeded {
  crisisNature?: string[];
  debrisPresent?: boolean;
  electricityStatus?: string;
  healthStatus?: string;
  pressingNeeds?: string[];
}

export const EMPTY_SURVEY: SurveyData = {
  infrastructureType: [],
  infrastructureTypeOther: "",
  infrastructureDescription: "",
  crisisNature: [],
  debrisPresent: null,
  electricityStatus: "",
  healthStatus: "",
  pressingNeeds: [],
  pressingNeedsOther: "",
};

// Values stored in the database (always English)
export const INFRASTRUCTURE_TYPES = [
  {
    key: "residential",
    value: "Residential Infrastructure (Houses and apartments)",
  },
  {
    key: "commercial",
    value:
      "Commercial Infrastructure (Markets, malls, shops, hotels, banks, industries, etc.)",
  },
  {
    key: "government",
    value:
      "Government Building (Administrative buildings, courthouses, police stations, fire stations, etc.)",
  },
  {
    key: "utility",
    value:
      "Utility Infrastructure (Water pumps, power plants, waste treatment plants, etc.)",
  },
  {
    key: "transport",
    value:
      "Transport and Communication Infrastructure (Roads, cell towers, bridges, railway station, bus station, etc.)",
  },
  {
    key: "community",
    value:
      "Community Infrastructure (Schools, hospitals, community halls, public toilets, etc.)",
  },
  {
    key: "publicSpaces",
    value:
      "Public spaces/Recreation Infrastructure (stadiums, playgrounds, religious buildings, etc.)",
  },
];

export const SURVEY_STEP_COUNT = 7;

export const isSurveyStepComplete = (
  step: number,
  data: SurveyData,
): boolean => {
  switch (step) {
    case 0:
      return data.infrastructureType.length > 0;
    case 1:
      return true;
    case 2:
      return data.crisisNature.length > 0;
    case 3:
      return data.debrisPresent === true || data.debrisPresent === false;
    case 4:
      return Boolean(data.electricityStatus);
    case 5:
      return Boolean(data.healthStatus);
    case 6:
      return data.pressingNeeds.length > 0;
    default:
      return false;
  }
};
