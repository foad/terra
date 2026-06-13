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

const savedLanguage =
  localStorage.getItem("terra-language") ||
  navigator.language.split("-")[0] ||
  "en";

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

i18n.on("languageChanged", (lng) => {
  document.documentElement.dir = RTL_LANGUAGES.includes(lng) ? "rtl" : "ltr";
  document.documentElement.lang = lng;
  localStorage.setItem("terra-language", lng);
});

document.documentElement.dir = RTL_LANGUAGES.includes(i18n.language)
  ? "rtl"
  : "ltr";
document.documentElement.lang = i18n.language;

export default i18n;

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "ar", name: "العربية" },
  { code: "zh", name: "中文" },
  { code: "fr", name: "Français" },
  { code: "ru", name: "Русский" },
  { code: "es", name: "Español" },
  { code: "tr", name: "Türkçe" },
];
