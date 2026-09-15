import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AdminLayout from "./AdminLayout";
import StatusBadge from "../../components/StatusBadge";
import { listRepairs } from "../../services/adminService";
import { getErrorMessage } from "../../services/api";

export default function Requests() {
  const { t } = useTranslation();
  const [repairs, setRepairs] = useState([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const FILTERS = [
    { value: "", label: "All" },
    { value: "REQUESTED", label: t("status.REQUESTED") },
    { value: "APPROVED", label: t("status.APPROVED") },
    { value: "ASSIGNED", label: t("status.ASSIGNED") },
    { value: "REPAIRING", label: t("status.REPAIRING") },
    { value: "COMPLETED", label: t("status.COMPLETED") },
    { value: "REJECTED", label: t("status.REJECTED") },
  ];

  useEffect(() => {
    setLoading(true);
    listRepairs(filter || undefined)
      .then((data) => setRepairs(data.repairs))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t("nav.repair_requests")}</h1>
          <p className="text-xs font-normal text-slate-500 mt-1">Manage and assign customer repair requests</p>
        </div>

        <div className="flex flex-wrap items-center bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                filter === f.value
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 p-4 text-xs font-medium text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-xs font-medium text-slate-400">{t("common.loading")}</p>
        ) : repairs.length === 0 ? (
          <p className="p-8 text-center text-xs font-medium text-slate-400">{t("common.no_data")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="border-b border-slate-100 bg-slate-50 font-semibold uppercase tracking-wider text-slate-500 text-[11px]">
                <tr>
                  <th className="px-5 py-4">ID</th>
                  <th className="px-5 py-4">{t("auth.customer_role")}</th>
                  <th className="px-5 py-4">{t("customer.device_type")}</th>
                  <th className="px-5 py-4">{t("customer.preferred_date")}</th>
                  <th className="px-5 py-4">{t("common.status")}</th>
                  <th className="px-5 py-4 text-right">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {repairs.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4 font-bold text-slate-900">Job #{r.id}</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {r.customer_id ? (
                        <Link
                          to={`/admin/customers/${r.customer_id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {r.customer_name || r.customer?.name || `Customer #${r.customer_id}`}
                        </Link>
                      ) : (
                        r.customer_name || r.customer?.name || "Customer"
                      )}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {r.device?.brand} {r.device?.model}
                    </td>
                    <td className="px-5 py-4 text-slate-500">{r.preferred_date}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        to={`/admin/requests/${r.id}`}
                        className="btn-outline py-1.5 px-3 text-xs inline-flex items-center gap-1"
                      >
                        <span>{t("common.view_details")}</span>
                        <span>→</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
