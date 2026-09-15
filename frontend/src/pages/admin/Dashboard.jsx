import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AdminLayout from "./AdminLayout";
import StatusBadge from "../../components/StatusBadge";
import { getDashboard, listRepairs, getRepair, listTechnicians } from "../../services/adminService";
import { register } from "../../services/authService";
import { getErrorMessage } from "../../services/api";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [repairs, setRepairs] = useState([]);
  const [detailedRepairs, setDetailedRepairs] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [activities, setActivities] = useState([]);
  const [tableSearch, setTableSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const STAT_CARDS = [
    { key: "total_customers", label: t("admin.total_repairs") },
    { key: "total_technicians", label: t("admin.active_techs") },
    { key: "pending_requests", label: t("status.PENDING_ASSIGNMENT") },
    { key: "approved_requests", label: t("status.APPROVED") },
    { key: "active_repairs", label: t("status.IN_PROGRESS") },
    { key: "completed_repairs", label: t("status.COMPLETED") },
  ];

  // Modal States
  const [showAddTechModal, setShowAddTechModal] = useState(false);
  const [techFormData, setTechFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    skills: "",
    service_area: "",
  });
  const [techModalError, setTechModalError] = useState("");
  const [techModalSuccess, setTechModalSuccess] = useState("");
  const [techSubmitting, setTechSubmitting] = useState(false);

  const loadData = () => {
    setLoading(true);
    setError("");

    Promise.all([
      getDashboard(),
      listRepairs(),
      listTechnicians().catch(() => ({ technicians: [] })),
    ])
      .then(async ([dashRes, repRes, techRes]) => {
        setStats(dashRes.stats);
        const rawRepairs = repRes.repairs || [];
        setRepairs(rawRepairs);
        setTechnicians(techRes.technicians || []);

        const topRepairs = rawRepairs.slice(0, 10);
        const detailedList = await Promise.all(
          topRepairs.map((r) =>
            getRepair(r.id)
              .then((d) => d.repair)
              .catch(() => r)
          )
        );
        setDetailedRepairs(detailedList);

        const eventList = [];

        detailedList.forEach((r) => {
          if (r.created_at) {
            eventList.push({
              id: `req-${r.id}`,
              title: `${t("nav.new_repair")} #${r.id}`,
              description: `${r.customer?.name || "Customer"} - ${r.device?.brand || ""} ${r.device?.model || r.device?.device_type || "device"}`,
              timestamp: new Date(r.created_at),
              type: "REQUEST",
              status: r.status,
            });
          }
        });

        eventList.sort((a, b) => b.timestamp - a.timestamp);
        setActivities(eventList.slice(0, 8));
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRepairs = repairs.filter((r) => {
    if (!tableSearch.trim()) return true;
    const q = tableSearch.toLowerCase();
    const idMatch = String(r.id).includes(q);
    const deviceMatch = `${r.device?.brand || ""} ${r.device?.model || ""}`.toLowerCase().includes(q);
    const statusMatch = (r.status || "").toLowerCase().includes(q);
    const dateMatch = (r.preferred_date || "").toLowerCase().includes(q);
    return idMatch || deviceMatch || statusMatch || dateMatch;
  });

  const handleAddTechnicianSubmit = async (e) => {
    e.preventDefault();
    setTechModalError("");
    setTechModalSuccess("");
    setTechSubmitting(true);

    try {
      await register({
        ...techFormData,
        role: "TECHNICIAN",
      });
      setTechModalSuccess(t("common.success"));
      setTechFormData({
        name: "",
        email: "",
        phone: "",
        password: "",
        skills: "",
        service_area: "",
      });
      setTimeout(() => {
        setShowAddTechModal(false);
        setTechModalSuccess("");
        loadData();
      }, 1200);
    } catch (err) {
      setTechModalError(getErrorMessage(err));
    } finally {
      setTechSubmitting(false);
    }
  };

  return (
    <AdminLayout onOpenAddTechnician={() => setShowAddTechModal(true)}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            {t("admin.dashboard_title")}
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-normal">Manage system repair requests and technicians</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddTechModal(true)}
            className="btn-primary"
          >
            <span>+ {t("admin.add_technician")}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 font-medium">
          <span>{error}</span>
        </div>
      )}

      {/* STATISTICS CARDS GRID */}
      <section className="mb-8">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl border border-slate-100 bg-white animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {STAT_CARDS.map((card) => {
              const val = stats?.[card.key] ?? 0;
              const isCustCard = card.key === "total_customers";
              return (
                <div
                  key={card.key}
                  onClick={() => isCustCard && navigate("/admin/customers")}
                  className={`card p-4 shadow-xs ${
                    isCustCard ? "cursor-pointer hover:border-blue-300 transition-all" : ""
                  }`}
                >
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block truncate">{card.label}</span>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-slate-900">{val}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* MAIN TWO-COLUMN DASHBOARD GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">{t("nav.repair_requests")}</h2>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder={t("common.search")}
                className="input w-48 sm:w-56 py-1.5"
              />

              <Link
                to="/admin/requests"
                className="text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap"
              >
                {t("common.view_details")} →
              </Link>
            </div>
          </div>

          <div className="card overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">{t("common.loading")}</div>
            ) : filteredRepairs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">{t("common.no_data")}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="border-b border-slate-100 bg-slate-50/80 uppercase tracking-wider text-slate-400 text-[11px] font-bold">
                    <tr>
                      <th className="px-4 py-3.5">ID</th>
                      <th className="px-4 py-3.5">{t("auth.customer_role")}</th>
                      <th className="px-4 py-3.5">{t("customer.device_type")}</th>
                      <th className="px-4 py-3.5">{t("admin.technicians")}</th>
                      <th className="px-4 py-3.5">{t("common.status")}</th>
                      <th className="px-4 py-3.5">{t("customer.preferred_date")}</th>
                      <th className="px-4 py-3.5 text-right">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRepairs.slice(0, 6).map((r) => {
                      const detailed = detailedRepairs.find((d) => d.id === r.id);
                      const customerName = detailed?.customer?.name || r.customer?.name || `Customer #${r.customer_id}`;
                      const customerId = detailed?.customer_id || r.customer_id;
                      const techName = detailed?.assignment?.technician?.name || t("customer.not_assigned");

                      return (
                        <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3.5 font-bold text-slate-900">#{r.id}</td>
                          <td className="px-4 py-3.5 font-bold text-slate-900">
                            {customerId ? (
                              <Link
                                to={`/admin/customers/${customerId}`}
                                className="text-blue-600 hover:underline"
                              >
                                {customerName}
                              </Link>
                            ) : (
                              customerName
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600">
                            {r.device?.brand} {r.device?.model || r.device?.device_type}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600">
                            <span>{techName}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="px-4 py-3.5 text-slate-400">
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* RECENT ACTIVITY PANEL */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-slate-900">{t("notifications.title")}</h2>

          <div className="card p-5 shadow-xs">
            {loading ? (
              <p className="text-center text-xs text-slate-400 py-6">{t("common.loading")}</p>
            ) : activities.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6">{t("common.no_data")}</p>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                {activities.map((act) => (
                  <div key={act.id} className="relative flex flex-col text-xs">
                    <div className="absolute -left-[23px] top-0 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-4 ring-slate-50">
                      <span className="h-2 w-2 rounded-full bg-blue-600" />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs">{act.title}</span>
                    </div>

                    <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                      {act.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ADD TECHNICIAN MODAL */}
      {showAddTechModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <span>+ {t("admin.add_technician")}</span>
              </h3>
              <button
                onClick={() => setShowAddTechModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-medium"
              >
                ✕
              </button>
            </div>

            {techModalError && (
              <div className="rounded-xl bg-rose-50 p-3.5 text-xs text-rose-700 border border-rose-200 font-medium">
                {techModalError}
              </div>
            )}

            {techModalSuccess && (
              <div className="rounded-xl bg-emerald-50 p-3.5 text-xs text-emerald-700 border border-emerald-200 font-medium">
                {techModalSuccess}
              </div>
            )}

            <form onSubmit={handleAddTechnicianSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="label">{t("auth.name")}</label>
                <input
                  type="text"
                  required
                  value={techFormData.name}
                  onChange={(e) => setTechFormData({ ...techFormData, name: e.target.value })}
                  placeholder="e.g. Alex Johnson"
                  className="input"
                />
              </div>

              <div>
                <label className="label">{t("auth.email")}</label>
                <input
                  type="email"
                  required
                  value={techFormData.email}
                  onChange={(e) => setTechFormData({ ...techFormData, email: e.target.value })}
                  placeholder="e.g. alex@fixpoint.com"
                  className="input"
                />
              </div>

              <div>
                <label className="label">{t("auth.phone")}</label>
                <input
                  type="text"
                  value={techFormData.phone}
                  onChange={(e) => setTechFormData({ ...techFormData, phone: e.target.value })}
                  placeholder="e.g. +1 555-0192"
                  className="input"
                />
              </div>

              <div>
                <label className="label">{t("auth.password")}</label>
                <input
                  type="password"
                  required
                  value={techFormData.password}
                  onChange={(e) => setTechFormData({ ...techFormData, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  className="input"
                />
              </div>

              <div>
                <label className="label">{t("admin.skills")}</label>
                <input
                  type="text"
                  value={techFormData.skills}
                  onChange={(e) => setTechFormData({ ...techFormData, skills: e.target.value })}
                  placeholder="e.g. Smartphones, Laptops, Soldering"
                  className="input"
                />
              </div>

              <div>
                <label className="label">{t("admin.service_area")}</label>
                <input
                  type="text"
                  value={techFormData.service_area}
                  onChange={(e) => setTechFormData({ ...techFormData, service_area: e.target.value })}
                  placeholder="e.g. Downtown District"
                  className="input"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddTechModal(false)}
                  className="btn-outline"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={techSubmitting}
                  className="btn-primary"
                >
                  {techSubmitting ? t("common.submitting") : t("admin.add_technician")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
