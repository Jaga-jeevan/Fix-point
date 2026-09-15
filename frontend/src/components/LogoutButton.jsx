import React from "react";
import { useTranslation } from "react-i18next";

export default function LogoutButton({ onLogout, className = "" }) {
  const { t } = useTranslation();

  return (
    <button
      onClick={onLogout}
      className={`group relative flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-2.5 text-slate-600 shadow-2xs transition-all duration-300 ease-in-out hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 cursor-pointer overflow-hidden ${className}`}
      title={t("common.logout")}
      aria-label={t("common.logout")}
    >
      <div className="flex items-center">
        {/* Open Door Icon with Arrow */}
        <svg
          className="h-5 w-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-105"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {/* Angled open door panel */}
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 3.5L4.5 6.2v11.6L12 20.5V3.5z" />
          {/* Door handle dot */}
          <circle cx="6.8" cy="12" r="0.75" fill="currentColor" />
          {/* Doorway frame behind */}
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 7h5.5a1 1 0 011 1v8a1 1 0 01-1 1H12" />
          {/* Exit arrow */}
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.5 12h6.5m-2.5-2.5l2.5 2.5-2.5 2.5" />
        </svg>

        {/* Slide-out "Log Out" text on hover */}
        <span className="max-w-0 opacity-0 transition-all duration-300 ease-in-out group-hover:max-w-[100px] group-hover:opacity-100 group-hover:ml-2 whitespace-nowrap text-xs font-bold leading-none">
          {t("common.logout")}
        </span>
      </div>
    </button>
  );
}
