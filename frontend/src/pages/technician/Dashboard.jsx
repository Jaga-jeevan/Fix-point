import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import TechnicianLayout from "./TechnicianLayout";
import StatusBadge from "../../components/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import {
  getDashboard,
  listJobs,
  setAvailability,
} from "../../services/technicianService";
import { getErrorMessage } from "../../services/api";

const ACTIVE_STATUSES = ["ON_THE_WAY", "DEVICE_RECEIVED", "REPAIRING"];

export default function TechnicianDashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  const GROUPS = [
    { key: "ASSIGNED", label: t("status.ASSIGNED") },
    { key: "ACCEPTED", label: t("technician.accepted_jobs") },
    { key: "ACTIVE", label: t("technician.active_jobs") },
    { key: "COMPLETED", label: t("technician.completed_jobs") },
  ];

  function loadAll() {
    return Promise.all([getDashboard(), listJobs()]).then(
      ([dash, jobsData]) => {
        setStats({
          ...dash.stats,
          availability_status: dash.availability_status,
          is_available: dash.is_available,
        });
        setJobs(jobsData.jobs || []);
      }
    );
  }

  useEffect(() => {
    loadAll()
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  function jobsFor(groupKey) {
    if (groupKey === "ACTIVE") return jobs.filter((j) => ACTIVE_STATUSES.includes(j.status));
    return jobs.filter((j) => j.status === groupKey);
  }

  async function handleSetAvailability(targetStatus) {
    if (!stats || stats.availability_status === targetStatus) return;
    setTogglingAvailability(true);
    setError("");
    try {
      const data = await setAvailability(targetStatus);
      setStats((prev) => ({
        ...prev,
        availability_status: data.availability_status,
        is_available: data.availability_status === "AVAILABLE",
      }));
      loadAll().catch(() => {});
    } catch (err) {
      setError(getErrorMessage(err));
      loadAll().catch(() => {});
    } finally {
      setTogglingAvailability(false);
    }
  }

  return (
    <TechnicianLayout>
      {/* WELCOME BACK BANNER */}
      <div className="mb-6 rounded-2xl bg-[#0E1726] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs border border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-800/80 border border-slate-700/60 px-3 py-1 text-[11px] font-medium text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>{t("technician.console", "Technician Console")}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-3">
            {t("customer.welcome_back", { name: user?.name?.split(" ")[0] || "Technician" })}
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 font-normal mt-2 max-w-xl leading-relaxed">
            {t("technician.dashboard_title", "Manage your assigned repair jobs, track active repairs, and update your work availability.")}
          </p>
        </div>

        {/* AVAILABILITY CONTROLS */}
        {stats && (
          stats.availability_status === "BUSY" ? (
            <span className="rounded-xl bg-amber-500/20 border border-amber-500/40 px-4 py-2 text-xs font-semibold text-amber-300 inline-flex items-center gap-2 shadow-xs self-start md:self-auto">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              {t("status.BUSY")}
            </span>
          ) : (
            <div className="inline-flex bg-slate-900/90 p-1.5 rounded-xl border border-slate-700/80 shadow-md self-start md:self-auto">
              <button
                onClick={() => handleSetAvailability("AVAILABLE")}
                disabled={togglingAvailability}
                aria-pressed={stats.availability_status === "AVAILABLE"}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all inline-flex items-center gap-2 ${
                  stats.availability_status === "AVAILABLE"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${stats.availability_status === "AVAILABLE" ? "bg-white" : "bg-emerald-400"}`} />
                {t("status.AVAILABLE")}
              </button>
              <button
                onClick={() => handleSetAvailability("OFFLINE")}
                disabled={togglingAvailability}
                aria-pressed={stats.availability_status === "OFFLINE"}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all inline-flex items-center gap-2 ${
                  stats.availability_status === "OFFLINE"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${stats.availability_status === "OFFLINE" ? "bg-white" : "bg-slate-500"}`} />
                {t("status.OFFLINE")}
              </button>
            </div>
          )
        )}
      </div>

      {error && <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 font-medium">{error}</div>}

      {/* METRIC STAT CARDS */}
      {stats && (
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="card p-5 border-l-4 border-l-slate-400 shadow-xs">
            <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">{t("technician.assigned_jobs")}</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{stats.assigned || 0}</p>
          </div>
          <div className="card p-5 border-l-4 border-l-amber-500 shadow-xs">
            <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">{t("technician.accepted_jobs")}</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{stats.accepted || 0}</p>
          </div>
          <div className="card p-5 border-l-4 border-l-blue-500 shadow-xs">
            <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">{t("technician.active_jobs")}</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{stats.active || 0}</p>
          </div>
          <div className="card p-5 border-l-4 border-l-emerald-500 shadow-xs">
            <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">{t("technician.completed_jobs")}</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">{stats.completed || 0}</p>
          </div>
        </div>
      )}

      {/* MAIN JOBS CONTAINER CARD */}
      <div className="card p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">{t("nav.my_jobs")}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{t("technician.recent_jobs_subtitle", "View and manage your active and assigned jobs.")}</p>
          </div>
          <Link to="/technician/jobs" className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1 self-start sm:self-auto">
            <span>{t("technician.view_jobs_hub", "View Jobs Hub")} →</span>
          </Link>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">{t("common.loading")}</div>
        ) : (
          <div className="space-y-6">
            {GROUPS.map((group) => {
              const groupJobs = jobsFor(group.key);
              if (groupJobs.length === 0) return null;
              return (
                <div key={group.key} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{group.label}</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                      {groupJobs.length}
                    </span>
                  </div>

                  <div className="space-y-3.5">
                    {groupJobs.map((job) => {
                      const deviceName = `${job.device?.brand || ""} ${job.device?.model || ""}`.trim() || job.device?.device_type || "Device";
                      const description = job.problem_description || job.issue_description || t("customer.no_description", "No description provided.");

                      return (
                        <Link
                          key={job.id}
                          to={`/technician/jobs/${job.id}`}
                          className="block rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 hover:border-blue-300 hover:shadow-md transition-all group shadow-2xs space-y-2.5"
                        >
                          {/* TOP ROW */}
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                              Job #{job.id} — {deviceName}
                            </h4>
                            <StatusBadge status={job.status} />
                          </div>

                          {/* SECOND ROW */}
                          {(job.preferred_date || job.device?.device_type || job.address) && (
                            <div className="text-xs text-slate-400 font-medium flex flex-wrap items-center gap-2">
                              {job.preferred_date && <span>{job.preferred_date}</span>}
                              {job.device?.device_type && (
                                <span>{job.preferred_date ? "· " : ""}{job.device.device_type}</span>
                              )}
                              {job.address && (
                                <span>{(job.preferred_date || job.device?.device_type) ? "· " : ""}📍 {job.address}</span>
                              )}
                            </div>
                          )}

                          {/* THIRD ROW */}
                          <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-100">
                            <p className="text-xs sm:text-sm text-slate-600 font-normal line-clamp-1 flex-1">
                              {description}
                            </p>
                            <span className="text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 shrink-0">
                              {t("common.view_details", "View Details")} →
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {jobs.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 sm:p-10 text-center flex flex-col items-center justify-center">
                <div className="h-12 w-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 text-xl mb-3">
                  📋
                </div>
                <h3 className="text-base font-bold text-slate-900">{t("technician.no_jobs_title", "No Active Jobs")}</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  {t("technician.no_jobs_subtitle", "You currently have no jobs assigned or accepted.")}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </TechnicianLayout>
  );
}
