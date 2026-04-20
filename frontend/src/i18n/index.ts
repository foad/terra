import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";

const RTL_LANGUAGES = ["ar"];

const savedLanguage = localStorage.getItem("terra-language") || navigator.language.split("-")[0] || "en";

i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: savedLanguage,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

// Update document direction when language changes
i18n.on("languageChanged", (lng) => {
  document.documentElement.dir = RTL_LANGUAGES.includes(lng) ? "rtl" : "ltr";
  document.documentElement.lang = lng;
  localStorage.setItem("terra-language", lng);
});

// Set initial direction
document.documentElement.dir = RTL_LANGUAGES.includes(i18n.language) ? "rtl" : "ltr";
document.documentElement.lang = i18n.language;

export default i18n;
