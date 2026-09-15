import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import TechnicianLayout from "./TechnicianLayout";
import StatusBadge from "../../components/StatusBadge";
import {
  getDashboard,
  listJobs,
  listAvailableRequests,
  acceptAvailableRequest,
  setAvailability,
} from "../../services/technicianService";
import { getErrorMessage } from "../../services/api";

const ACTIVE_STATUSES = ["ON_THE_WAY", "DEVICE_RECEIVED", "REPAIRING"];

export default function JobsHub() {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [availableRequests, setAvailableRequests] = useState([]);
  const [error, setError] = useState("");
  const [claimError, setClaimError] = useState("");
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  const GROUPS = [
    { key: "ASSIGNED", label: t("technician.assigned_jobs") },
    { key: "ACCEPTED", label: t("technician.accepted_jobs") },
    { key: "ACTIVE", label: t("technician.active_jobs") },
    { key: "COMPLETED", label: t("technician.completed_jobs") },
  ];

  function loadAll() {
    return Promise.all([getDashboard(), listJobs(), listAvailableRequests()]).then(
      ([dash, jobsData, availableData]) => {
        setStats({
          ...dash.stats,
          availability_status: dash.availability_status,
          is_available: dash.is_available,
        });
        setJobs(jobsData.jobs || []);
        setAvailableRequests(availableData.requests || []);
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

  async function handleClaim(requestId) {
    if (stats?.availability_status !== "AVAILABLE") {
      setClaimError("You are currently offline. Go online to accept new repair requests.");
      return;
    }
    setClaimingId(requestId);
    setClaimError("");
    try {
      await acceptAvailableRequest(requestId);
      await loadAll();
    } catch (err) {
      setClaimError(getErrorMessage(err));
      loadAll().catch(() => {});
    } finally {
      setClaimingId(null);
    }
  }

  async function handleSetAvailability(targetStatus) {
    if (!stats || stats.availability_status === targetStatus) return;
    setTogglingAvailability(true);
    setError("");
    setClaimError("");
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
      {/* PAGE TITLE & AVAILABILITY TOGGLE */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t("technician.jobs_hub")}</h1>
          <p className="text-xs text-slate-400 mt-1 font-normal">{t("technician.dashboard_title")}</p>
        </div>

        {stats && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{t("common.status")}:</span>
            {stats.availability_status === "BUSY" ? (
              <span className="rounded-xl bg-amber-50 border border-amber-200/60 px-3.5 py-1.5 text-xs font-semibold text-amber-700 inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {t("status.BUSY")}
              </span>
            ) : (
              <div className="inline-flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                <button
                  onClick={() => handleSetAvailability("AVAILABLE")}
                  disabled={togglingAvailability}
                  aria-pressed={stats.availability_status === "AVAILABLE"}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
                    stats.availability_status === "AVAILABLE"
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${stats.availability_status === "AVAILABLE" ? "bg-white" : "bg-indigo-500"}`} />
                  {t("status.AVAILABLE")}
                </button>
                <button
                  onClick={() => handleSetAvailability("OFFLINE")}
                  disabled={togglingAvailability}
                  aria-pressed={stats.availability_status === "OFFLINE"}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
                    stats.availability_status === "OFFLINE"
                      ? "bg-slate-800 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${stats.availability_status === "OFFLINE" ? "bg-white" : "bg-slate-400"}`} />
                  {t("status.OFFLINE")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 font-medium">{error}</div>}

      {/* SECTION A: JOB SUMMARY */}
      {stats && (
        <div className="mb-8">
          <p className="mb-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {t("technician.dashboard_title")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="card p-5 border-l-4 border-l-slate-400 shadow-xs">
              <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">{t("technician.assigned_jobs")}</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{stats.assigned || 0}</p>
            </div>
            <div className="card p-5 border-l-4 border-l-amber-500 shadow-xs">
              <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">{t("technician.accepted_jobs")}</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">{stats.accepted || 0}</p>
            </div>
            <div className="card p-5 border-l-4 border-l-blue-500 shadow-xs">
              <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">{t("technician.active_jobs")}</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{stats.active || 0}</p>
            </div>
            <div className="card p-5 border-l-4 border-l-emerald-500 shadow-xs">
              <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">{t("technician.completed_jobs")}</p>
              <p className="text-3xl font-bold text-emerald-600 mt-2">{stats.completed || 0}</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400 p-4">{t("common.loading")}</p>
      ) : (
        <div className="space-y-8">
          {/* SECTION B: AVAILABLE REQUESTS */}
          <div id="available-requests-section" className="card p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div>
                <h2 className="text-base font-bold text-slate-900">{t("technician.available_requests")}</h2>
                <p className="text-xs text-slate-400 mt-0.5 font-normal">{t("technician.requests_waiting_subtitle")}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                  stats?.availability_status === "AVAILABLE"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {t("common.status")}: {stats?.availability_status ? t(`status.${stats.availability_status}`) : "..."}
              </span>
            </div>

            {claimError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 font-medium">{claimError}</div>
            )}

            {availableRequests.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs font-semibold text-slate-500">No records found.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">No unassigned requests currently available.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {availableRequests.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between rounded-xl border border-slate-100 p-4 bg-white hover:border-slate-200 transition-all gap-4 shadow-2xs"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {t("customer.request_id")} #{r.id} — {r.device?.device_type} {r.device?.brand} {r.device?.model}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {t("customer.preferred_date")}: {r.preferred_date || "Asap"} at {r.preferred_time || "N/A"} · {r.address}
                      </p>
                      {r.problem_description && (
                        <p className="text-xs text-slate-500 mt-1.5 italic bg-slate-50 rounded-lg p-2 border border-slate-100">"{r.problem_description}"</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleClaim(r.id)}
                      disabled={claimingId === r.id || stats?.availability_status !== "AVAILABLE"}
                      className={`btn-primary text-xs px-4 py-2.5 whitespace-nowrap rounded-xl ${
                        stats?.availability_status !== "AVAILABLE" ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      {claimingId === r.id ? t("common.submitting") : t("technician.claim_job")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION C: MY JOBS */}
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
              {t("technician.active_jobs")}
            </h2>

            {GROUPS.map((group) => {
              const groupJobs = jobsFor(group.key);
              if (groupJobs.length === 0) return null;
              return (
                <div key={group.key} className="card p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-sm font-bold text-slate-800">{group.label}</h3>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                      {groupJobs.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {groupJobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex flex-wrap items-center justify-between rounded-xl border border-slate-100 p-4 bg-white hover:border-slate-200 transition-all gap-4 shadow-2xs"
                      >
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-slate-900">
                              Job #{job.id} — {job.device?.brand} {job.device?.model}
                            </span>
                            <StatusBadge status={job.status} />
                          </div>
                          <p className="text-xs text-slate-400 mt-1.5">
                            {t("auth.customer_role")}: {job.customer_name || job.customer?.name || "N/A"} ({job.customer?.phone || "N/A"}) · {job.address}
                          </p>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <Link
                            to={`/technician/jobs/${job.id}`}
                            className="btn-outline text-xs px-3.5 py-2 rounded-xl"
                          >
                            {t("common.view_details")}
                          </Link>
                          <Link
                            to="/technician/progress"
                            className="btn-primary text-xs px-3.5 py-2 rounded-xl"
                          >
                            {t("nav.job_progress")}
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {jobs.length === 0 && availableRequests.length === 0 && (
              <p className="text-xs text-slate-400 py-4">{t("common.no_data")}</p>
            )}
          </div>
        </div>
      )}
    </TechnicianLayout>
  );
}
