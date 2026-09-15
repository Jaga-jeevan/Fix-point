import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AdminLayout from "./AdminLayout";
import StatusBadge from "../../components/StatusBadge";
import RepairTimeline from "../../components/RepairTimeline";
import { getRepair, approveRepair, rejectRepair } from "../../services/adminService";
import { getErrorMessage } from "../../services/api";

export default function RequestDetails() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [repair, setRepair] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  function loadRepair() {
    setLoading(true);
    getRepair(id)
      .then((data) => setRepair(data.repair))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(loadRepair, [id]);

  async function handleApprove() {
    setError("");
    setActionLoading(true);
    try {
      await approveRepair(id);
      loadRepair();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(e) {
    e.preventDefault();
    setError("");
    setActionLoading(true);
    try {
      await rejectRepair(id, rejectReason);
      setShowReject(false);
      loadRepair();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <p className="text-xs text-ink-400">{t("common.loading")}</p>
      </AdminLayout>
    );
  }

  if (!repair) {
    return (
      <AdminLayout>
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            {error}
          </div>
        )}
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Link
        to="/admin/requests"
        className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
      >
        <span>←</span>
        <span>{t("common.back")} {t("nav.repair_requests")}</span>
      </Link>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 p-4 text-xs font-medium text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card space-y-6 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t("customer.request_id")} #{repair.id}</h1>
              <p className="text-xs text-slate-500 mt-0.5">Submitted on {repair.created_at ? new Date(repair.created_at).toLocaleDateString() : "N/A"}</p>
            </div>
            <StatusBadge status={repair.status} />
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <dt className="text-slate-400 font-medium">{t("auth.customer_role")}</dt>
              <dd className="font-semibold text-slate-900 text-sm mt-0.5">
                {repair.customer_id ? (
                  <Link
                    to={`/admin/customers/${repair.customer_id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {repair.customer?.name || `Customer #${repair.customer_id}`}
                  </Link>
                ) : (
                  repair.customer?.name || "N/A"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400 font-medium">{t("auth.phone")}</dt>
              <dd className="font-semibold text-slate-900 text-sm mt-0.5">{repair.customer?.phone || "N/A"}</dd>
            </div>
            <div>
              <dt className="text-slate-400 font-medium">{t("customer.device_type")}</dt>
              <dd className="font-semibold text-slate-900 text-sm mt-0.5">
                {repair.device?.device_type} — {repair.device?.brand} {repair.device?.model}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400 font-medium">{t("customer.preferred_date")}</dt>
              <dd className="font-semibold text-slate-900 text-sm mt-0.5">
                {repair.preferred_date} at {repair.preferred_time}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-400 font-medium">{t("customer.problem_description")}</dt>
              <dd className="mt-1 rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-slate-700 font-medium leading-relaxed">
                {repair.problem_description}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-400 font-medium">{t("customer.address")}</dt>
              <dd className="font-semibold text-slate-900 text-sm mt-0.5">{repair.address}</dd>
            </div>
          </dl>

          {repair.photos?.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("customer.device_photo")}</p>
              <div className="flex gap-3">
                {repair.photos.map((p) => (
                  <div key={p.id} className="text-center">
                    <img
                      src={`${import.meta.env.VITE_API_URL.replace("/api", "")}${p.photo_url}`}
                      alt={p.photo_type}
                      className="h-24 w-24 rounded-xl border border-slate-200 object-cover"
                    />
                    <p className="mt-1 text-[10px] font-medium text-slate-500">{p.photo_type}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">{t("common.actions")}</p>

            {repair.status === "REQUESTED" && !showReject && (
              <div className="flex gap-3">
                <button
                  disabled={actionLoading}
                  onClick={handleApprove}
                  className="btn-primary bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10"
                >
                  {t("quotation.approve")}
                </button>
                <button
                  disabled={actionLoading}
                  onClick={() => setShowReject(true)}
                  className="btn-outline border-red-200 text-red-600 hover:bg-red-50"
                >
                  {t("quotation.reject")}
                </button>
              </div>
            )}

            {repair.status === "REQUESTED" && showReject && (
              <form onSubmit={handleReject} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">{t("quotation.reject")}</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Optional details"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="btn-primary bg-red-600 hover:bg-red-700"
                  >
                    {t("common.confirm")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReject(false)}
                    className="btn-outline"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </form>
            )}

            {repair.assignment?.technician && (
              <div className="mt-4 rounded-xl bg-blue-50/50 border border-blue-100 p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{t("customer.assigned_technician")}</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{repair.assignment.technician.name}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                  Assigned
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">{t("technician.job_progress")}</h2>
          <RepairTimeline status={repair.status} history={repair.status_history} quotation={repair.quotation} />
        </div>
      </div>
    </AdminLayout>
  );
}
