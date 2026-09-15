import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AdminLayout from "./AdminLayout";
import { listCustomers } from "../../services/adminService";
import { getErrorMessage } from "../../services/api";

export default function Customers() {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchCustomers = (query = "") => {
    setLoading(true);
    setError("");
    listCustomers(query)
      .then((data) => {
        setCustomers(data.customers || []);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const totalCustomers = customers.length;
  const customersWithActiveRepairs = customers.filter((c) => (c.active_requests || 0) > 0).length;
  const totalRegisteredDevices = customers.reduce((sum, c) => sum + (c.devices_count || 0), 0);

  return (
    <AdminLayout>
      {/* PAGE HEADER */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {t("admin.customers_title")}
          </h1>
          <p className="text-xs font-normal text-slate-500 mt-1">
            {t("admin.customers_subtitle")}
          </p>
        </div>

        {/* SEARCH BAR */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("common.search_placeholder")}
            className="input w-full pl-9 py-2 text-xs"
          />
          <svg
            className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"
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
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 p-4 text-xs font-medium text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* SUMMARY STATS */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {t("admin.total_customers")}
            </span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              {totalCustomers}
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-base">
            👤
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {t("admin.active_customers")}
            </span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              {customersWithActiveRepairs}
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-base">
            🛠️
          </div>
        </div>

        <div className="card p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {t("admin.registered_devices")}
            </span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              {totalRegisteredDevices}
            </span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-base">
            📱
          </div>
        </div>
      </div>

      {/* CUSTOMERS TABLE */}
      <div className="card overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-xs font-medium text-slate-400">
            {t("common.loading")}
          </p>
        ) : customers.length === 0 ? (
          <p className="p-8 text-center text-xs font-medium text-slate-400">
            {t("admin.no_customers")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="border-b border-slate-100 bg-slate-50 font-semibold uppercase tracking-wider text-slate-500 text-[11px]">
                <tr>
                  <th className="px-5 py-4">{t("admin.customer_name")}</th>
                  <th className="px-5 py-4">{t("auth.phone")}</th>
                  <th className="px-5 py-4">{t("admin.total_repairs")}</th>
                  <th className="px-5 py-4">{t("customer.active_repairs")}</th>
                  <th className="px-5 py-4">{t("admin.joined_date")}</th>
                  <th className="px-5 py-4 text-right">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                          {customer.name ? customer.name.charAt(0).toUpperCase() : "C"}
                        </div>
                        <div>
                          <Link
                            to={`/admin/customers/${customer.id}`}
                            className="font-bold text-slate-900 hover:text-blue-600 transition-colors"
                          >
                            {customer.name}
                          </Link>
                          <p className="text-[11px] text-slate-400 font-normal">
                            {customer.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-600">
                      {customer.phone || "—"}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {customer.total_requests || 0}
                    </td>
                    <td className="px-5 py-4">
                      {customer.active_requests > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          {customer.active_requests} Active
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {customer.created_at
                        ? new Date(customer.created_at).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        to={`/admin/customers/${customer.id}`}
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
