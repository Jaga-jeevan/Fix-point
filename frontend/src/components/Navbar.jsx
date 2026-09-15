import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";
import LanguageSelector from "./LanguageSelector";
import LogoutButton from "./LogoutButton";
import Logo from "./Logo";

export default function Navbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [voiceState, setVoiceState] = useState({ state: "idle", isOpen: false });

  useEffect(() => {
    const handleStateChange = (e) => {
      if (e.detail) {
        setVoiceState(e.detail);
      }
    };
    window.addEventListener("voice-assistant-state-change", handleStateChange);
    return () => window.removeEventListener("voice-assistant-state-change", handleStateChange);
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const roleSubtitle =
    user?.role === "CUSTOMER"
      ? t("auth.customer_role")
      : user?.role === "TECHNICIAN"
        ? t("auth.technician_role")
        : user?.role;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-100 bg-white px-4 md:px-6 shadow-2xs">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Toggle Sidebar"
            aria-label="Toggle navigation"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <Logo size="md" />
          <div className="flex flex-col">
            <span className="font-bold text-lg text-slate-900 tracking-tight leading-none">
              {t("common.app_name")}
            </span>
            {roleSubtitle && (
              <span className="text-[10px] font-bold text-purple-600 tracking-wider uppercase mt-0.5">
                {roleSubtitle}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <LanguageSelector />

        {user && (
          <>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("toggle-voice-assistant"))}
              className="va-btn-anim"
              title="FixPoint Voice Assistant"
              aria-label="Toggle Voice Assistant"
            >
              <div className="va-btn-content">
                {/* Microphone Icon Badge */}
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-lg font-bold transition-colors ${
                    voiceState.state === "listening"
                      ? "bg-rose-700 text-white"
                      : voiceState.state === "processing"
                        ? "bg-amber-600 text-white"
                        : "bg-black/15 text-black"
                  }`}
                >
                  {voiceState.state === "processing" ? (
                    <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </div>

                  <span className="hidden sm:inline" style={{ color: "#000000" }}>
                    {voiceState.state === "listening"
                      ? t("voice.listening")
                      : voiceState.state === "processing"
                        ? t("voice.processing")
                        : voiceState.state === "speaking"
                          ? t("voice.speaking")
                          : t("voice.assistant_title")}
                  </span>
              </div>
            </button>

            {(user.role === "CUSTOMER" || user.role === "TECHNICIAN") && (
              <NotificationBell role={user.role} />
            )}

            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-100">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200/50">
                {user.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-900 leading-tight">
                  {user.name}
                </span>
                <span className="text-[11px] text-slate-400 font-normal leading-tight mt-0.5">
                  {user.email}
                </span>
              </div>
            </div>

            <LogoutButton onLogout={handleLogout} />
          </>
        )}
      </div>
    </header>
  );
}
