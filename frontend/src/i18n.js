import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ta from "./locales/ta.json";
import hi from "./locales/hi.json";

const savedLanguage = localStorage.getItem("fixpoint_language") || "en";

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ta: { translation: ta },
      hi: { translation: hi },
    },
    lng: savedLanguage,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // React already safes from xss
    },
  });

i18n.on("languageChanged", (lng) => {
  localStorage.setItem("fixpoint_language", lng);
});

export default i18n;
