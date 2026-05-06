import { latLngToCell } from "h3-js";
import type { SurveyData } from "../components/survey-form";

const STORAGE_KEY = "terra-survey-prefs";
const H3_RESOLUTION = 8;

interface StoredPrefs {
  debrisPresent: boolean | null;
  electricityStatus: string;
  healthStatus: string;
  pressingNeeds: string[];
  savedAt: string;
}

type PrefsByCell = Record<string, StoredPrefs>;

const readAll = (): PrefsByCell => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PrefsByCell) : {};
  } catch {
    return {};
  }
};

const writeAll = (prefs: PrefsByCell) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Quota exceeded or storage unavailable — pre-seeding is best-effort.
  }
};

export const loadSurveyPrefs = (lat: number, lng: number): StoredPrefs | null => {
  const cell = latLngToCell(lat, lng, H3_RESOLUTION);
  const all = readAll();
  return all[cell] ?? null;
};

export const saveSurveyPrefs = (lat: number, lng: number, survey: SurveyData): void => {
  const cell = latLngToCell(lat, lng, H3_RESOLUTION);
  const all = readAll();
  all[cell] = {
    debrisPresent: survey.debrisPresent,
    electricityStatus: survey.electricityStatus,
    healthStatus: survey.healthStatus,
    pressingNeeds: survey.pressingNeeds,
    savedAt: new Date().toISOString(),
  };
  writeAll(all);
};

export const mergeEmptyFields = (survey: SurveyData, prefs: StoredPrefs): SurveyData => ({
  ...survey,
  debrisPresent: survey.debrisPresent ?? prefs.debrisPresent ?? null,
  electricityStatus: survey.electricityStatus || prefs.electricityStatus || "",
  healthStatus: survey.healthStatus || prefs.healthStatus || "",
  pressingNeeds:
    survey.pressingNeeds.length > 0 ? survey.pressingNeeds : (prefs.pressingNeeds ?? []),
});
