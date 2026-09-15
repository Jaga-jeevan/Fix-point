import React from "react";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ta", label: "தமிழ்" },
  { code: "hi", label: "हिन्दी" },
];

export default function LanguageSelector({ className = "" }) {
  const { i18n } = useTranslation();

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    i18n.changeLanguage(newLang);
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <select
        value={i18n.language}
        onChange={handleLanguageChange}
        aria-label="Select Language"
        className="appearance-none rounded-xl border border-slate-200 bg-white py-1.5 pl-3 pr-7 text-xs font-semibold text-slate-700 shadow-2xs hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20 cursor-pointer transition-colors"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code} className="bg-white text-slate-800">
            {lang.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
