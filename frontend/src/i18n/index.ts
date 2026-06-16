import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import ar from "./ar.json";
import zh from "./zh.json";
import fr from "./fr.json";
import ru from "./ru.json";
import es from "./es.json";
import tr from "./tr.json";

const RTL_LANGUAGES = ["ar"];

// Hoisted so SUPPORTED_LANGUAGE_CODES can be derived from it (single source of truth).
export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "ar", name: "العربية" },
  { code: "zh", name: "中文" },
  { code: "fr", name: "Français" },
  { code: "ru", name: "Русский" },
  { code: "es", name: "Español" },
  { code: "tr", name: "Türkçe" },
];

const SUPPORTED_LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

// A `?lng=` URL param (e.g. from a Community Activation Kit / WhatsApp deep
// link) takes precedence so a link opens straight into the right language
// (#228). Session-only: we don't persist it to localStorage so it doesn't
// overwrite the user's own preference on future visits.
const urlLanguage = new URLSearchParams(window.location.search).get("lng");
const validUrlLanguage =
  urlLanguage && SUPPORTED_LANGUAGE_CODES.includes(urlLanguage)
    ? urlLanguage
    : null;

// localStorage.getItem/setItem can throw in storage-restricted contexts
// (private browsing in some browsers) — guard every access at module load.
let savedLanguage: string;
try {
  savedLanguage =
    validUrlLanguage ||
    localStorage.getItem("terra-language") ||
    navigator.language.split("-")[0] ||
    "en";
} catch {
  savedLanguage = validUrlLanguage || navigator.language.split("-")[0] || "en";
}

// Register before init() so the handler catches any synchronous
// languageChanged event that fires during initialisation.
i18n.on("languageChanged", (lng) => {
  document.documentElement.dir = RTL_LANGUAGES.includes(lng) ? "rtl" : "ltr";
  document.documentElement.lang = lng;
  // Don't persist the URL-param language — it's session-only (#228).
  if (validUrlLanguage && lng === validUrlLanguage) return;
  try {
    localStorage.setItem("terra-language", lng);
  } catch {
    // Storage unavailable — language reverts to default on next visit.
  }
});

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
    zh: { translation: zh },
    fr: { translation: fr },
    ru: { translation: ru },
    es: { translation: es },
    // Beyond the six core UN languages: local languages are one locale file
    // each — Turkish serves the simulated Antakya deployment (#205).
    tr: { translation: tr },
  },
  lng: savedLanguage,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

document.documentElement.dir = RTL_LANGUAGES.includes(i18n.language)
  ? "rtl"
  : "ltr";
document.documentElement.lang = i18n.language;

export default i18n;
