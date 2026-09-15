import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import TechnicianLayout from "./TechnicianLayout";
import StatusBadge from "../../components/StatusBadge";
import RepairTimeline from "../../components/RepairTimeline";
import Chat from "../../components/Chat";
import QuotationPanel from "../../components/QuotationPanel";
import RepairActionsPanel from "../../components/RepairActionsPanel";
import PartsUsedPanel from "../../components/PartsUsedPanel";
import {
  getJob,
  acceptJob,
  startTravel,
  receiveDevice,
  startRepair,
  completeJob,
  verifyOTP,
} from "../../services/technicianService";
import { getErrorMessage } from "../../services/api";

export default function JobDetails() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState(null);
  const [tab, setTab] = useState("quotation");
  const [otpInput, setOtpInput] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpVerifying, setOtpVerifying] = useState(false);

  const ACTION_TABS = [
    { key: "quotation", label: t("quotation.title") },
    { key: "actions", label: t("common.actions") },
    { key: "parts", label: t("parts.title") },
  ];

  function loadJob() {
    setLoading(true);
    getJob(id)
      .then((data) => setJob(data.job))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    window.scrollTo(0, 0);
    loadJob();
  }, [id]);

  async function runAction(fn) {
    setError("");
    setActionLoading(true);
    try {
      await fn();
      loadJob();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReceiveDevice(e) {
    e.preventDefault();
    setError("");
    setActionLoading(true);
    const formData = new FormData();
    formData.append("notes", notes);
    if (photo) formData.append("photo", photo);
    try {
      await receiveDevice(id, formData);
      loadJob();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleVerifyOTP(e) {
    e.preventDefault();
    setOtpError("");
    const code = otpInput.trim();
    if (!code || code.length !== 6) {
      setOtpError(t("technician.valid_otp_error") || "Please enter a valid 6-digit OTP.");
      return;
    }
    setOtpVerifying(true);
    try {
      const res = await verifyOTP(id, code);
      setJob((prev) => ({
        ...prev,
        otp_status: {
          is_verified: true,
          verified_at: res.verified_at || new Date().toISOString(),
          is_expired: false,
        },
      }));
      setOtpInput("");
    } catch (err) {
      setOtpError(getErrorMessage(err));
    } finally {
      setOtpVerifying(false);
    }
  }

  if (loading) {
    return (
      <TechnicianLayout>
        <p className="text-sm text-ink-400">{t("common.loading")}</p>
      </TechnicianLayout>
    );
  }

  if (!job) {
    return (
      <TechnicianLayout>
        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      </TechnicianLayout>
    );
  }

  const isOtpVerified = !!job.otp_status?.is_verified;
  const isPaymentVerified = job.quotation?.payment_status === "PAID";

  return (
    <TechnicianLayout>
      {/* TOP NAVIGATION BREADCRUMB */}
      <div className="mb-4 flex items-center gap-3 text-sm text-ink-500 font-medium">
        <Link to="/technician/progress" className="hover:underline text-ink-700">
          ← {t("common.back")} {t("nav.job_progress")}
        </Link>
        <span>·</span>
        <Link to="/technician/jobs" className="hover:underline text-ink-500">
          {t("technician.jobs_hub")}
        </Link>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* TWO-COLUMN TOP LAYOUT: LEFT JOB DETAILS & RIGHT JOB ACTIONS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
        {/* LEFT COLUMN: MAIN JOB INFORMATION CARD */}
        <div className="space-y-6 lg:col-span-2">
          <div className="card space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <div>
                <h1 className="font-display text-xl font-bold text-ink-800">Job #{job.id}</h1>
                <p className="text-xs text-ink-400">{t("common.date")}: {job.created_at ? new Date(job.created_at).toLocaleDateString() : "N/A"}</p>
              </div>
              <StatusBadge status={job.status} />
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs font-semibold text-ink-400 uppercase tracking-wider">{t("auth.name")}</dt>
                <dd className="text-sm font-medium text-ink-800 mt-0.5">{job.customer_name || job.customer?.name || "N/A"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-ink-400 uppercase tracking-wider">{t("auth.phone")}</dt>
                <dd className="text-sm font-medium text-ink-800 mt-0.5">{job.customer?.phone || "N/A"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold text-ink-400 uppercase tracking-wider">{t("customer.address")}</dt>
                <dd className="text-sm font-medium text-ink-800 mt-0.5">{job.address || "N/A"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-ink-400 uppercase tracking-wider">{t("customer.device_type")}</dt>
                <dd className="text-sm font-medium text-ink-800 mt-0.5">
                  {job.device?.device_type} — {job.device?.brand} {job.device?.model}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-ink-400 uppercase tracking-wider">{t("customer.preferred_date")} / {t("customer.preferred_time")}</dt>
                <dd className="text-sm font-medium text-ink-800 mt-0.5">
                  {job.preferred_date || "Asap"} at {job.preferred_time || "N/A"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold text-ink-400 uppercase tracking-wider">{t("customer.problem_description")}</dt>
                <dd className="text-sm font-medium text-ink-800 mt-0.5 bg-ink-50 p-2.5 rounded-md border border-ink-100">
                  {job.problem_description || "No description provided."}
                </dd>
              </div>
            </dl>

            {job.photos?.length > 0 && (
              <div className="border-t border-ink-100 pt-3">
                <p className="mb-2 text-xs font-semibold text-ink-400 uppercase tracking-wider">{t("customer.device_photo")}</p>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {job.photos.map((p) => (
                    <div key={p.id} className="text-center flex-shrink-0">
                      <img
                        src={`${import.meta.env.VITE_API_URL.replace("/api", "")}${p.photo_url}`}
                        alt={p.photo_type}
                        className="h-20 w-20 rounded-md object-cover border border-ink-200"
                      />
                      <p className="mt-1 text-[10px] text-ink-400">{p.photo_type}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CUSTOMER VISIT OTP VERIFICATION PANEL (Shown AFTER Start Travel) */}
            {job.status !== "ASSIGNED" && job.status !== "ACCEPTED" && (
              <div className="border-t border-ink-100 pt-4 mt-4 bg-ink-50 p-4 rounded-lg border border-ink-200">
                <h3 className="text-xs font-bold text-ink-700 uppercase tracking-wider mb-2">
                  {t("technician.customer_visit_verification")}
                </h3>

                {isOtpVerified ? (
                  <div className="text-xs font-semibold text-signal-700 bg-signal-50 p-3 rounded-md border border-signal-200 flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 text-sm font-bold">
                      <span>✓</span>
                      <span>{t("technician.customer_visit_verified")}</span>
                    </div>
                    {job.otp_status?.verified_at && (
                      <p className="text-[11px] font-normal text-signal-600">
                        {t("technician.verified_at")}: {new Date(job.otp_status.verified_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      <p className="text-xs text-ink-600 font-medium">
                        {t("technician.enter_otp_hint")}
                      </p>
                    </div>

                    <form onSubmit={handleVerifyOTP} className="space-y-3">
                      {otpError && (
                        <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 font-medium">
                          {otpError}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-ink-500 mb-1">
                            {t("technician.enter_otp_label")}
                          </label>
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="──────"
                            value={otpInput}
                            onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                            className="input text-base font-mono font-bold tracking-widest text-center max-w-[150px] py-1.5"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={otpVerifying || otpInput.length !== 6}
                          className={`btn-primary text-xs px-4 py-2 self-end ${
                            otpInput.length !== 6 ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                        >
                          {otpVerifying ? t("common.submitting") : t("technician.verify_otp")}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* ACTION STATUS WORKFLOW BUTTONS */}
            <div className="border-t border-ink-100 pt-4">
              <p className="mb-2 text-xs font-semibold text-ink-500 uppercase tracking-wider">{t("common.actions")}</p>

              {(job.status === "ASSIGNED" || job.status === "ACCEPTED") && (
                <button
                  disabled={actionLoading}
                  onClick={() => runAction(() => startTravel(id))}
                  className="btn-primary"
                >
                  {t("technician.start_travel")}
                </button>
              )}

              {job.status === "ON_THE_WAY" && (
                <div>
                  {isOtpVerified ? (
                    <form onSubmit={handleReceiveDevice} className="space-y-3 bg-ink-50 p-3.5 rounded-md border border-ink-100">
                      <div>
                        <label className="label text-xs">{t("customer.problem_description")}</label>
                        <textarea
                          className="input text-xs"
                          rows={2}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder={t("customer.problem_placeholder")}
                        />
                      </div>
                      <div>
                        <label className="label text-xs">{t("customer.device_photo")}</label>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png"
                          onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                          className="text-xs"
                        />
                      </div>
                      <button type="submit" disabled={actionLoading} className="btn-primary text-xs">
                        {t("technician.receive_device")}
                      </button>
                    </form>
                  ) : (
                    <div className="p-3 bg-amber-50 rounded-md border border-amber-200 text-xs text-amber-800">
                      <p className="font-semibold mb-0.5">{t("technician.verification_pending_title")}</p>
                      <p className="text-[11px] text-amber-700">
                        {t("technician.verification_pending_desc")}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {job.status === "DEVICE_RECEIVED" && (
                <button
                  disabled={actionLoading}
                  onClick={() => runAction(() => startRepair(id))}
                  className="btn-primary"
                >
                  {t("technician.start_diagnosis")}
                </button>
              )}

              {job.status === "REPAIRING" && (
                <div>
                  {isPaymentVerified ? (
                    <button
                      disabled={actionLoading}
                      onClick={() => runAction(() => completeJob(id))}
                      className="btn-success"
                    >
                      {t("technician.complete_job")}
                    </button>
                  ) : (
                    <div className="rounded-lg bg-amber-50 p-4 border border-amber-200/80 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        <span>{t("technician.payment_verification_required")}</span>
                      </div>
                      <p className="text-xs text-amber-800">
                        {t("technician.payment_verification_desc")}
                      </p>
                      <button
                        type="button"
                        onClick={() => setTab("quotation")}
                        className="text-xs font-bold text-amber-900 underline hover:text-amber-950 flex items-center gap-1"
                      >
                        {t("technician.go_to_quotation")}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {job.status === "COMPLETED" && (
                <div className="flex items-center gap-2 rounded-md bg-signal-50 border border-signal-200 px-3 py-2 text-xs font-semibold text-signal-800">
                  <span>✓</span>
                  <span>{t("status.COMPLETED")}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: JOB ACTIONS PANEL */}
        <div className="space-y-6 lg:col-span-1">
          <div className="card p-6 min-h-[360px]">
            <div className="mb-4 border-b border-ink-100 pb-3">
              <h2 className="font-display text-base font-bold text-ink-800 uppercase tracking-wider">
                {t("technician.job_details")}
              </h2>
            </div>

            {/* TAB SELECTION HEADER FOR JOB ACTIONS */}
            <div className="mb-6 border-b border-ink-100 flex flex-wrap gap-1.5 pb-3">
              {ACTION_TABS.map((tItem) => {
                const isActive = tab === tItem.key;
                return (
                  <button
                    key={tItem.key}
                    onClick={() => setTab(tItem.key)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                      isActive
                        ? "bg-ink-800 text-white shadow-xs"
                        : "bg-ink-50 text-ink-600 hover:bg-ink-100 hover:text-ink-800 border border-ink-100"
                    }`}
                  >
                    {tItem.label}
                  </button>
                );
              })}
            </div>

            {tab === "quotation" && <QuotationPanel repairId={job.id} role="TECHNICIAN" onUpdate={loadJob} />}
            {tab === "actions" && <RepairActionsPanel repairId={job.id} canEdit={true} />}
            {tab === "parts" && <PartsUsedPanel repairId={job.id} canEdit={true} />}
          </div>
        </div>
      </div>

      {/* SEPARATE SECTION: CHAT */}
      <div className="mt-8 card p-6">
        <div className="mb-4 border-b border-ink-100 pb-3">
          <h2 className="font-display text-lg font-bold text-ink-800">{t("chat.title")}</h2>
          <p className="text-xs text-ink-400">Job #{job.id}</p>
        </div>
        <Chat repairId={job.id} enabled={true} recipientName={job.customer?.name || "Customer"} />
      </div>

      {/* FULL-WIDTH STATUS TIMELINE */}
      <div className="mt-8 card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 pb-3">
          <div>
            <h2 className="font-display text-lg font-bold text-ink-800">{t("technician.job_progress")}</h2>
            <p className="text-xs text-ink-400">{t("common.status")}</p>
          </div>
          {job.status === "COMPLETED" && (
            <span className="rounded-full bg-signal-600 px-3 py-1 text-xs font-bold text-white shadow-xs">
              ★ {t("status.COMPLETED")}
            </span>
          )}
        </div>
        <RepairTimeline status={job.status} history={job.status_history} quotation={job.quotation} />
      </div>
    </TechnicianLayout>
  );
}
