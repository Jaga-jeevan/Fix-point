import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../../components/Layout";
import StatusBadge from "../../components/StatusBadge";
import RepairTimeline from "../../components/RepairTimeline";
import Chat from "../../components/Chat";
import QuotationPanel from "../../components/QuotationPanel";
import RepairActionsPanel from "../../components/RepairActionsPanel";
import PartsUsedPanel from "../../components/PartsUsedPanel";
import { getMyRepair, deleteMyRepair } from "../../services/customerService";
import { getErrorMessage } from "../../services/api";

export default function RepairDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [repair, setRepair] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("quotation");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const ACTION_TABS = [
    { key: "quotation", label: t("quotation.title") },
    { key: "actions", label: t("common.actions") },
    { key: "parts", label: t("parts.title") },
  ];

  useEffect(() => {
    window.scrollTo(0, 0);
    getMyRepair(id)
      .then((data) => setRepair(data.repair))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteMyRepair(id);
      navigate("/customer/repairs", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  const isDeletable =
    repair && !["ACCEPTED", "ON_THE_WAY", "DEVICE_RECEIVED", "REPAIRING", "PAYMENT_DONE", "COMPLETED"].includes(repair.status);

  if (loading) {
    return (
      <Layout>
        <p className="text-sm text-ink-400">{t("common.loading")}</p>
      </Layout>
    );
  }

  if (!repair) {
    return (
      <Layout>
        <Link to="/customer/repairs" className="mb-4 inline-block text-sm text-ink-500 hover:underline">
          ← {t("common.back")} {t("nav.my_repairs")}
        </Link>
        {error ? (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        ) : (
          <p className="text-sm text-ink-400">{t("common.no_data")}</p>
        )}
      </Layout>
    );
  }

  const tech = repair.technician || repair.assignment?.technician;

  return (
    <Layout>
      {/* TOP NAVIGATION BREADCRUMB */}
      <div className="mb-4 flex items-center gap-3 text-xs text-slate-400 font-semibold">
        <Link to="/customer/repairs" className="hover:text-blue-600 transition-colors flex items-center gap-1">
          ← {t("common.back")} {t("nav.my_repairs")}
        </Link>
      </div>

      {error && <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 font-medium">{error}</div>}

      {/* TWO-COLUMN TOP LAYOUT: REPAIR INFORMATION (LEFT) & TECHNICIAN WORK DETAILS (RIGHT) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
        {/* LEFT COLUMN: MAIN REPAIR & CUSTOMER INFORMATION CARD */}
        <div className="space-y-6 lg:col-span-2">
          <div className="card space-y-5 p-6 md:p-8 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900">{t("customer.request_id")} #{repair.id}</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t("common.date")}: {repair.created_at ? new Date(repair.created_at).toLocaleDateString() : "N/A"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={repair.status} />
                {isDeletable && (
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition-all shadow-2xs cursor-pointer"
                    title="Delete repair request before acceptance"
                  >
                    <span>🗑️</span>
                    <span>{t("common.delete_request", "Delete Request")}</span>
                  </button>
                )}
              </div>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <dt className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t("customer.device_type")}</dt>
                <dd className="text-xs font-bold text-slate-900 mt-1">
                  {repair.device?.device_type} — {repair.device?.brand} {repair.device?.model}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t("customer.preferred_date")} / {t("customer.preferred_time")}</dt>
                <dd className="text-xs font-bold text-slate-900 mt-1">
                  {repair.preferred_date || "N/A"} at {repair.preferred_time || "N/A"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t("customer.address")}</dt>
                <dd className="text-xs font-semibold text-slate-900 mt-1">{repair.address || "N/A"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t("customer.problem_description")}</dt>
                <dd className="text-xs font-medium text-slate-800 mt-1 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  {repair.problem_description || t("customer.no_description")}
                </dd>
              </div>
              {tech && (
                <div className="sm:col-span-2 border-t border-slate-100 pt-4">
                  <dt className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t("customer.assigned_technician")}</dt>
                  <dd className="text-xs font-bold text-slate-900 mt-2 flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-bold shadow-2xs">👤</span>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{tech.name}</p>
                        {tech.phone && (
                          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                            📱 {tech.phone}
                          </p>
                        )}
                      </div>
                    </div>
                    {tech.phone && (
                      <a
                        href={`tel:${tech.phone}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-all shadow-xs cursor-pointer"
                      >
                        <span>📞</span>
                        <span>{t("common.call", "Call Technician")}</span>
                      </a>
                    )}
                  </dd>
                </div>
              )}
            </dl>

            {repair.photos?.length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <p className="mb-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t("customer.device_photo")}</p>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {repair.photos.map((p) => (
                    <div key={p.id} className="text-center flex-shrink-0">
                      <img
                        src={`${import.meta.env.VITE_API_URL.replace("/api", "")}${p.photo_url}`}
                        alt={p.photo_type}
                        className="h-20 w-20 rounded-xl object-cover border border-slate-200 shadow-2xs"
                      />
                      <p className="mt-1 text-[10px] text-slate-400">{p.photo_type}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ACCEPTED BANNER (Shown when status is accepted/active before OTP or alongside) */}
            {!repair.otp && tech && (
              <div className="border-t border-slate-100 pt-4 mt-4 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200/70 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg font-bold">
                    👤
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                      {t("customer.assigned_technician")} — Request Accepted
                    </span>
                    <p className="text-xs font-bold text-slate-900 mt-0.5">{tech.name}</p>
                    {tech.phone && <p className="text-[11px] font-semibold text-slate-600">📱 {tech.phone}</p>}
                  </div>
                </div>
                {tech.phone && (
                  <a
                    href={`tel:${tech.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 text-white px-3.5 py-2 text-xs font-bold hover:bg-emerald-700 transition-colors shadow-2xs"
                  >
                    <span>📞</span>
                    <span>{tech.phone}</span>
                  </a>
                )}
              </div>
            )}

            {/* CUSTOMER VISIT VERIFICATION OTP CARD (Shown AFTER Start Travel) */}
            {repair.otp && (
              <div className="border-t border-slate-100 pt-4 mt-4 bg-blue-50/50 p-5 rounded-2xl border border-blue-200/70">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-600 animate-pulse" />
                    <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                      {t("customer.technician_on_the_way")}
                    </h3>
                  </div>
                  <span
                    className={`px-3 py-0.5 text-xs font-semibold rounded-full border ${
                      repair.otp.is_used
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {repair.otp.is_used ? `✓ ${t("customer.verified")}` : t("customer.pending_verification")}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mb-3">
                  {t("customer.otp_instructions")}
                </p>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{t("customer.otp_label")}</span>
                    <div className="font-mono text-2xl font-bold tracking-widest text-slate-900 bg-white px-5 py-2.5 rounded-xl border border-slate-200 shadow-xs inline-block">
                      {repair.otp.otp_code}
                    </div>
                  </div>
                </div>

                {tech && (
                  <div className="mt-4 pt-3 border-t border-blue-200/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold shadow-2xs">
                        👤
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">{t("customer.assigned_technician")}</span>
                        <span className="text-xs font-bold text-slate-900">{tech.name}</span>
                      </div>
                    </div>
                    {tech.phone && (
                      <a
                        href={`tel:${tech.phone}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 text-white px-3 py-1.5 text-xs font-bold hover:bg-blue-700 transition-colors shadow-2xs"
                      >
                        <span>📞</span>
                        <span>{tech.phone}</span>
                      </a>
                    )}
                  </div>
                )}

                {repair.otp.is_used && repair.otp.verified_at && (
                  <p className="text-[11px] text-emerald-700 font-semibold mt-2.5">
                    ✓ {t("customer.verified_on")} {new Date(repair.otp.verified_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: TECHNICIAN WORK DETAILS PANEL */}
        <div className="space-y-6 lg:col-span-1">
          <div className="card p-6 shadow-xs min-h-[360px]">
            <div className="mb-4 border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {t("technician.job_details")}
              </h2>
            </div>

            {/* TAB SELECTION HEADER */}
            <div className="mb-6 inline-flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs w-full">
              {ACTION_TABS.map((tItem) => {
                const isActive = tab === tItem.key;
                return (
                  <button
                    key={tItem.key}
                    onClick={() => setTab(tItem.key)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all text-center ${
                      isActive
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {tItem.label}
                  </button>
                );
              })}
            </div>

            {tab === "quotation" && <QuotationPanel repairId={repair.id} role="CUSTOMER" />}
            {tab === "actions" && <RepairActionsPanel repairId={repair.id} canEdit={false} />}
            {tab === "parts" && <PartsUsedPanel repairId={repair.id} canEdit={false} />}
          </div>
        </div>
      </div>

      {/* SEPARATE SECTION: CHAT */}
      <div className="mt-8 card p-6 shadow-xs">
        <div className="mb-4 border-b border-slate-100 pb-3">
          <h2 className="text-lg font-bold text-slate-900">{t("chat.title")}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{t("customer.request_id")} #{repair.id}</p>
        </div>
        <Chat
          repairId={repair.id}
          enabled={!!repair.assignment}
          recipientName={repair.assignment?.technician?.name || "Technician"}
        />
      </div>

      {/* FULL-WIDTH STATUS TIMELINE */}
      <div className="mt-8 card p-6 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t("technician.job_progress")}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{t("common.status")}</p>
          </div>
          {repair.status === "COMPLETED" && (
            <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-xs">
              ★ {t("status.COMPLETED")}
            </span>
          )}
        </div>
        <RepairTimeline status={repair.status} history={repair.status_history} quotation={repair.quotation} />
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="card max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 bg-white rounded-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center text-lg font-bold">
                ⚠️
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{t("customer.delete_request_title", "Delete Repair Request")}</h3>
                <p className="text-xs text-slate-500">{t("customer.delete_request_subtitle", "This action cannot be undone.")}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
              {t("customer.delete_request_confirm_msg", "Are you sure you want to delete repair request")} <strong className="text-slate-900">#{repair.id} ({repair.device?.brand} {repair.device?.model})</strong>?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="btn-outline text-xs px-4 py-2"
              >
                {t("common.cancel", "Cancel")}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {deleting ? (
                  <span>{t("common.deleting", "Deleting...")}</span>
                ) : (
                  <>
                    <span>🗑️</span>
                    <span>{t("common.confirm_delete", "Delete Request")}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

