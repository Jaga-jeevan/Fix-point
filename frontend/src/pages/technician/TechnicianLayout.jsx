import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import NotificationBell from "../../components/NotificationBell";
import LanguageSelector from "../../components/LanguageSelector";
import LogoutButton from "../../components/LogoutButton";
import Logo from "../../components/Logo";
import { getDashboard, listJobs, setAvailability } from "../../services/technicianService";
import { getErrorMessage } from "../../services/api";

export default function TechnicianLayout({ children, onSelectOption }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'profile' | 'schedule' | 'messages'
  const [techStats, setTechStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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

  const getActiveTab = () => {
    if (activeModal) return activeModal;
    if (location.pathname.startsWith("/technician/messages")) return "messages";
    if (location.pathname.startsWith("/technician/progress")) return "progress";
    if (location.pathname.startsWith("/technician/jobs")) return "jobs";
    if (location.pathname.startsWith("/technician/dashboard")) return "dashboard";
    return "jobs";
  };

  const activeTab = getActiveTab();

  const fetchTechData = () => {
    setLoading(true);
    Promise.all([
      getDashboard().catch(() => null),
      listJobs().catch(() => ({ jobs: [] })),
    ])
      .then(([dashData, jobsData]) => {
        if (dashData) {
          setTechStats({
            ...dashData.stats,
            availability_status: dashData.availability_status,
            is_available: dashData.is_available,
          });
        }
        if (jobsData) setJobs(jobsData.jobs || []);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTechData();
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleOptionClick = (optionKey) => {
    if (optionKey === "dashboard") {
      setActiveModal(null);
      navigate("/technician/dashboard");
    } else if (optionKey === "jobs") {
      setActiveModal(null);
      navigate("/technician/jobs");
    } else if (optionKey === "progress") {
      setActiveModal(null);
      navigate("/technician/progress");
    } else if (optionKey === "messages") {
      setActiveModal(null);
      navigate("/technician/messages");
    } else if (optionKey === "logout") {
      handleLogout();
    } else {
      setActiveModal(optionKey);
    }

    if (onSelectOption) onSelectOption(optionKey);
  };

  const handleToggleAvailability = async (targetStatus) => {
    try {
      const data = await setAvailability(targetStatus);
      setTechStats((prev) => ({
        ...prev,
        availability_status: data.availability_status,
      }));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const navItems = [
    {
      key: "dashboard",
      path: "/technician/dashboard",
      label: t("nav.dashboard"),
      icon: (
        <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 00-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      key: "jobs",
      path: "/technician/jobs",
      label: t("technician.jobs_hub"),
      icon: (
        <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      key: "progress",
      path: "/technician/progress",
      label: t("nav.job_progress"),
      icon: (
        <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      key: "schedule",
      label: t("nav.my_schedule"),
      icon: (
        <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      key: "messages",
      path: "/technician/messages",
      label: t("nav.messages"),
      icon: (
        <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      key: "profile",
      label: t("nav.my_profile"),
      icon: (
        <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex flex-col">
      {/* HEADER WITH SIDEBAR TOGGLE BUTTON */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-100 bg-white px-4 md:px-6 shadow-2xs">
        <div className="flex items-center gap-3">
          {/* Menu / Hamburger toggle control */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs"
            title={isCollapsed ? "Expand Navigation" : "Collapse Navigation"}
            aria-label="Toggle navigation"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link to="/technician/dashboard" className="flex items-center gap-2.5">
            <Logo size="md" />
            <div className="flex flex-col">
              <span className="font-bold text-lg text-slate-900 tracking-tight leading-none">
                {t("common.app_name")}
              </span>
              <span className="text-[10px] font-bold text-purple-600 tracking-wider uppercase mt-0.5">
                {t("auth.technician_role")}
              </span>
            </div>
          </Link>
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

              <NotificationBell role={user.role} />

              <div className="flex items-center gap-2.5 pl-2 border-l border-slate-100">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200/50">
                  {user.name ? user.name.charAt(0).toUpperCase() : "T"}
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

      {/* MAIN BODY WITH LEFT COLLAPSIBLE NAVIGATION */}
      <div className="flex flex-1 min-h-[calc(100vh-4rem)]">
        {/* LEFT TECHNICIAN NAVIGATION PANEL */}
        <aside
          className={`flex-shrink-0 border-r border-slate-100 bg-white flex flex-col transition-all duration-300 ease-in-out ${
            isCollapsed ? "w-16 p-2" : "w-60 p-4"
          }`}
        >
          {/* TOP NAVIGATION OPTIONS */}
          <nav className="space-y-2 overflow-y-auto select-none">
            {navItems.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => handleOptionClick(item.key)}
                  title={isCollapsed ? item.label : undefined}
                  className="group relative w-full block text-left cursor-pointer"
                >
                  {/* 3D Base/Bottom Depth Layer */}
                  <div
                    className={`absolute inset-0 rounded-xl transition-all duration-150 ease-out ${
                      isActive
                        ? "bg-blue-800 translate-y-1 shadow-sm shadow-blue-900/30"
                        : "bg-slate-200 group-hover:bg-slate-300 translate-y-0.5"
                    }`}
                  />

                  {/* 3D Top Face Layer */}
                  <div
                    className={`relative flex items-center gap-3 w-full rounded-xl px-4 py-2.5 text-xs transition-all duration-150 ease-out ${
                      isCollapsed ? "justify-center px-2" : ""
                    } ${
                      isActive
                        ? "bg-gradient-to-b from-blue-500 to-blue-600 text-white font-bold border-t border-white/35 shadow-xs -translate-y-0.5 group-active:translate-y-0.5"
                        : "bg-white text-slate-700 font-semibold border border-slate-200/80 -translate-y-0.5 group-hover:-translate-y-1 group-hover:text-blue-600 group-hover:bg-slate-50 group-active:translate-y-0"
                    }`}
                  >
                    {item.icon}
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* MAIN DASHBOARD CONTENT */}
        <main className="min-w-0 flex-1 p-6 md:p-8 overflow-y-auto">{children}</main>
      </div>

      {/* OPTION MODALS */}

      {/* MY PROFILE MODAL */}
      {activeModal === "profile" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-slate-900">{t("technician.profile_title")}</h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 text-xl font-medium">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400">{t("auth.name")}</span>
                <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
              </div>
              <div>
                <span className="text-slate-400">{t("auth.email")}</span>
                <p className="text-sm font-semibold text-slate-900">{user?.email}</p>
              </div>
              <div>
                <span className="text-slate-400">{t("auth.phone")}</span>
                <p className="text-sm font-semibold text-slate-900">{user?.phone || "Not set"}</p>
              </div>
              <div>
                <span className="text-slate-400">{t("auth.role")}</span>
                <p className="text-sm font-semibold text-slate-900">{t("auth.technician_role")}</p>
              </div>
              <div>
                <span className="text-slate-400">{t("technician.availability_status")}</span>
                <p className="text-sm font-semibold text-slate-900">{t(`status.${techStats?.availability_status || "AVAILABLE"}`)}</p>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button onClick={() => setActiveModal(null)} className="btn-primary">{t("common.close")}</button>
            </div>
          </div>
        </div>
      )}

      {/* MY SCHEDULE MODAL */}
      {activeModal === "schedule" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-slate-900">{t("technician.schedule_title")}</h3>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 text-xl font-medium">✕</button>
            </div>
            <div className="max-h-80 overflow-y-auto space-y-2 text-xs">
              {jobs.length === 0 ? (
                <p className="text-slate-400 p-2">{t("technician.no_scheduled")}</p>
              ) : (
                jobs.map((j) => (
                  <div key={j.id} className="rounded-xl border border-slate-100 p-3.5 bg-slate-50/50">
                    <div className="flex justify-between font-bold text-slate-900">
                      <span>Job #{j.id} — {j.device?.brand} {j.device?.model}</span>
                      <span className="rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-[11px] font-semibold border border-emerald-200/60">{j.status}</span>
                    </div>
                    <p className="text-slate-500 mt-1 flex items-center gap-1.5">
                      <span>📅</span> {t("customer.preferred_date")}: {j.preferred_date || "Asap"} at {j.preferred_time || "N/A"}
                    </p>
                    <p className="text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <span>📍</span> {j.address}
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="pt-2 flex justify-end">
              <button onClick={() => setActiveModal(null)} className="btn-primary">{t("common.close")}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
