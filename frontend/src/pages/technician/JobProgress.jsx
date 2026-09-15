import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import TechnicianLayout from "./TechnicianLayout";
import StatusBadge from "../../components/StatusBadge";
import { listJobs } from "../../services/technicianService";
import { getErrorMessage } from "../../services/api";

const STEP_KEYS = [
  "REQUESTED",
  "APPROVED",
  "ASSIGNED",
  "ACCEPTED",
  "ON_THE_WAY",
  "DEVICE_RECEIVED",
  "REPAIRING",
  "PAYMENT_DONE",
  "COMPLETED",
];

function getStepIndex(status) {
  if (!status) return 0;
  if (status === "REPAIR_COMPLETED") return 6;
  const idx = STEP_KEYS.indexOf(status);
  return idx >= 0 ? idx : 0;
}

export default function JobProgress() {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listJobs()
      .then((data) => setJobs(data.jobs || []))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const filteredJobs = jobs.filter((j) => {
    if (filter === "ACTIVE") return !["COMPLETED", "CANCELLED"].includes(j.status);
    if (filter === "COMPLETED") return j.status === "COMPLETED";
    return true;
  });

  return (
    <TechnicianLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t("nav.job_progress")}</h1>
          <p className="text-xs text-slate-400 mt-1 font-normal">{t("technician.job_progress_subtitle")}</p>
        </div>

        <div className="inline-flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
          <button
            onClick={() => setFilter("ALL")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
              filter === "ALL" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t("technician.all_jobs_count", { count: jobs.length })}
          </button>
          <button
            onClick={() => setFilter("ACTIVE")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
              filter === "ACTIVE" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t("technician.active_jobs_count", {
              count: jobs.filter((j) => !["COMPLETED", "CANCELLED"].includes(j.status)).length,
            })}
          </button>
          <button
            onClick={() => setFilter("COMPLETED")}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-all ${
              filter === "COMPLETED" ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t("technician.completed_jobs_count", {
              count: jobs.filter((j) => j.status === "COMPLETED").length,
            })}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 font-medium">{error}</div>}

      {loading ? (
        <p className="text-xs text-slate-400 p-4">{t("common.loading")}</p>
      ) : filteredJobs.length === 0 ? (
        <div className="card p-8 text-center text-slate-400 text-xs font-medium">
          {t("common.no_data")}
        </div>
      ) : (
        <div className="space-y-5">
          {filteredJobs.map((job) => {
            const currentStepIdx = getStepIndex(job.status);
            return (
              <div key={job.id} className="card p-6 shadow-xs space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-base font-bold text-slate-900">
                        Job #{job.id} — {job.device?.brand} {job.device?.model}
                      </h2>
                      <StatusBadge status={job.status} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400 mt-1.5">
                      <span className="flex items-center gap-1.5">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {job.customer_name || job.customer?.name || "N/A"}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <svg className="h-3.5 w-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        {job.address || "N/A"}
                      </span>
                    </div>
                  </div>
                  <Link
                    to={`/technician/jobs/${job.id}`}
                    className="btn-primary text-xs px-4 py-2 rounded-xl"
                  >
                    {t("common.view_details")} →
                  </Link>
                </div>

                {/* PROGRESS STEPPER */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {t("nav.job_progress")}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
                    {STEP_KEYS.map((stKey, idx) => {
                      let isDone = idx <= currentStepIdx;
                      if (stKey === "PAYMENT_DONE") {
                        isDone =
                          job.quotation?.payment_status === "PAID" ||
                          job.payment_status === "PAID" ||
                          !!job.status_history?.some((h) => h.status === "PAYMENT_DONE" || h.status === "PAID");
                      }
                      const isCurrent = idx === currentStepIdx && job.status !== "COMPLETED";
                      const stepLabel = t(`status.${stKey}`) !== `status.${stKey}` ? t(`status.${stKey}`) : stKey;
                      return (
                        <div
                          key={stKey}
                          className={`rounded-xl p-2.5 text-center text-[11px] transition-all ${
                            isCurrent
                              ? "bg-blue-50 border-2 border-blue-600 text-blue-700 font-bold shadow-xs"
                              : isDone
                              ? "bg-emerald-50/80 border border-emerald-200/80 text-emerald-700 font-semibold"
                              : "bg-white border border-slate-200 text-slate-400 opacity-60"
                          }`}
                        >
                          <div className="mb-1 flex justify-center">
                            {isDone ? (
                              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white">
                                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            ) : (
                              <span className="h-4 w-4 rounded-full border border-slate-300 inline-block" />
                            )}
                          </div>
                          <span className="block leading-tight">{stepLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 bg-slate-50/70 border border-slate-100 rounded-xl p-3">
                  <span>{t("customer.problem_description")}: <span className="font-semibold text-slate-900">{job.problem_description || "N/A"}</span></span>
                  <span>{t("customer.preferred_date")}: <span className="font-semibold text-slate-900">{job.preferred_date || "Asap"} at {job.preferred_time || "N/A"}</span></span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </TechnicianLayout>
  );
}
