import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AdminLayout from "./AdminLayout";
import StatusBadge from "../../components/StatusBadge";
import { getCustomer } from "../../services/adminService";
import { getErrorMessage } from "../../services/api";

export default function CustomerDetails() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCustomerData = () => {
    setLoading(true);
    setError("");
    getCustomer(id)
      .then((data) => setCustomer(data.customer))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCustomerData();
  }, [id]);

  if (loading) {
    return (
      <AdminLayout>
        <p className="text-xs text-slate-400 p-4">{t("common.loading")}</p>
      </AdminLayout>
    );
  }

  if (error || !customer) {
    return (
      <AdminLayout>
        <Link
          to="/admin/customers"
          className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          <span>←</span>
          <span>{t("common.back")} {t("admin.customers")}</span>
        </Link>
        <div className="rounded-xl bg-red-50 p-4 text-xs font-medium text-red-700 border border-red-200">
          {error || "Customer not found"}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* BACK BUTTON */}
      <Link
        to="/admin/customers"
        className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
      >
        <span>←</span>
        <span>{t("common.back")} {t("admin.customers")}</span>
      </Link>

      {/* CUSTOMER PROFILE CARD */}
      <div className="card p-6 mb-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-2xl font-bold shadow-md shadow-blue-600/20">
              {customer.name ? customer.name.charAt(0).toUpperCase() : "C"}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {customer.name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                  {t("auth.customer_role")}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Customer ID: #{customer.id} • Joined{" "}
                {customer.created_at
                  ? new Date(customer.created_at).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-center px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {t("admin.total_repairs")}
              </span>
              <span className="text-lg font-bold text-slate-900 mt-0.5 block">
                {customer.total_requests || 0}
              </span>
            </div>
            <div className="text-center px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {t("customer.active_repairs")}
              </span>
              <span className="text-lg font-bold text-amber-600 mt-0.5 block">
                {customer.active_requests || 0}
              </span>
            </div>
            <div className="text-center px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {t("admin.registered_devices")}
              </span>
              <span className="text-lg font-bold text-purple-600 mt-0.5 block">
                {customer.devices?.length || 0}
              </span>
            </div>
          </div>
        </div>

        {/* CONTACT DETAILS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 text-xs">
          <div>
            <span className="text-slate-400 font-medium block mb-1">
              {t("auth.email")}
            </span>
            <span className="font-semibold text-slate-900 text-sm">
              {customer.email}
            </span>
          </div>

          <div>
            <span className="text-slate-400 font-medium block mb-1">
              {t("auth.phone")}
            </span>
            <span className="font-semibold text-slate-900 text-sm">
              {customer.phone || "Not provided"}
            </span>
          </div>

          <div>
            <span className="text-slate-400 font-medium block mb-1">
              Account Status
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Active User
            </span>
          </div>
        </div>
      </div>

      {/* TWO COLUMN CONTENT LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* REPAIR REQUESTS HISTORY */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              {t("admin.repair_history")} ({customer.repair_requests?.length || 0})
            </h2>
          </div>

          <div className="card overflow-hidden shadow-xs">
            {!customer.repair_requests || customer.repair_requests.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-400">
                {t("customer.no_repairs")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="border-b border-slate-100 bg-slate-50 uppercase tracking-wider text-slate-400 text-[11px] font-bold">
                    <tr>
                      <th className="px-4 py-3.5">ID</th>
                      <th className="px-4 py-3.5">{t("customer.device_type")}</th>
                      <th className="px-4 py-3.5">{t("admin.technicians")}</th>
                      <th className="px-4 py-3.5">{t("common.status")}</th>
                      <th className="px-4 py-3.5">{t("customer.preferred_date")}</th>
                      <th className="px-4 py-3.5 text-right">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customer.repair_requests.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-slate-900">
                          #{r.id}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-semibold text-slate-900 block">
                            {r.device?.brand} {r.device?.model}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {r.device?.device_type}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 font-medium">
                          {r.assignment?.technician?.name || t("customer.not_assigned")}
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">
                          {r.preferred_date || "N/A"}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Link
                            to={`/admin/requests/${r.id}`}
                            className="btn-outline text-[11px] px-3 py-1.5 rounded-xl"
                          >
                            {t("common.view_details")}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* REGISTERED DEVICES LIST */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            {t("admin.registered_devices")} ({customer.devices?.length || 0})
          </h2>

          <div className="card p-5 space-y-3 shadow-xs">
            {!customer.devices || customer.devices.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-4">
                No registered devices.
              </p>
            ) : (
              customer.devices.map((device) => (
                <div
                  key={device.id}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-base text-slate-700 shadow-2xs">
                      {device.device_type === "Laptop" ? "💻" : device.device_type === "Mobile" ? "📱" : device.device_type === "TV" ? "📺" : "🔌"}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">
                        {device.brand} {device.model}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Type: {device.device_type}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
