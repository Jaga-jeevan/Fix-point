import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import TechnicianLayout from "./TechnicianLayout";
import Chat from "../../components/Chat";
import StatusBadge from "../../components/StatusBadge";
import { listJobs } from "../../services/technicianService";
import { getErrorMessage } from "../../services/api";

export default function TechnicianMessages() {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const getDeviceTitle = (job) => {
    if (!job) return "";
    const brand = job.device?.brand || job.brand || "";
    const model = job.device?.model || job.model || "";
    const brandAndModel = [brand, model].filter(Boolean).join(" ");
    if (brandAndModel) return brandAndModel;
    return job.device?.device_type || job.device_type || "";
  };

  const getCustomerName = (job) => {
    if (!job) return "Customer";
    if (job.customer_name) return job.customer_name;
    if (job.customer?.full_name) return job.customer.full_name;
    if (job.customer?.username) return job.customer.username;
    return "Customer";
  };

  useEffect(() => {
    setLoading(true);
    listJobs()
      .then((data) => {
        const jobList = data.jobs || [];
        setJobs(jobList);
        if (jobList.length > 0) {
          setSelectedJob(jobList[0]);
        }
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const filteredJobs = jobs.filter((job) => {
    const q = search.toLowerCase();
    const idStr = String(job.id);
    const custName = getCustomerName(job).toLowerCase();
    const devTitle = getDeviceTitle(job).toLowerCase();
    return idStr.includes(q) || custName.includes(q) || devTitle.includes(q);
  });

  return (
    <TechnicianLayout>
      <div className="space-y-6">
        {/* HEADER TITLE */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t("technician.messages_title")}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Direct real-time conversations with customers for active repair requests.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="card p-12 text-center text-xs text-slate-400">
            {t("common.loading")}
          </div>
        ) : jobs.length === 0 ? (
          <div className="card p-12 text-center text-slate-500">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              💬
            </div>
            <p className="text-sm font-semibold">{t("technician.no_messages")}</p>
            <p className="mt-1 text-xs text-slate-400">
              Once you accept repair requests, you can chat with customers directly here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* LEFT: CONVERSATION LIST */}
            <div className="lg:col-span-5 space-y-3">
              {/* SEARCH BOX */}
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter conversations..."
                  className="input pl-9"
                />
                <svg
                  className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              {/* LIST OF JOBS */}
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {filteredJobs.map((job) => {
                  const isSelected = selectedJob?.id === job.id;
                  const devTitle = getDeviceTitle(job);
                  const custName = getCustomerName(job);
                  return (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "border-blue-600 bg-blue-50/60 shadow-xs ring-1 ring-blue-600/20"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-bold text-xs text-slate-900">
                          Job #{job.id}{devTitle ? ` — ${devTitle}` : ""}
                        </span>
                        <StatusBadge status={job.status} />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{custName}</span>
                        <span className="text-[10px] font-semibold text-blue-600">Chat →</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: CHAT PANEL */}
            <div className="lg:col-span-7">
              {selectedJob ? (
                <div className="space-y-4">
                  <div className="card p-4 flex items-center justify-between bg-slate-50 border-slate-200">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">
                        Job #{selectedJob.id}{getDeviceTitle(selectedJob) ? `: ${getDeviceTitle(selectedJob)}` : ""}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Customer: <span className="font-semibold text-slate-700">{getCustomerName(selectedJob)}</span>
                      </p>
                    </div>
                    <StatusBadge status={selectedJob.status} />
                  </div>

                  <Chat
                    repairId={selectedJob.id}
                    enabled={true}
                    recipientName={getCustomerName(selectedJob)}
                  />
                </div>
              ) : (
                <div className="card p-12 text-center text-slate-400">
                  Select a conversation from the list to start messaging.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </TechnicianLayout>
  );
}
