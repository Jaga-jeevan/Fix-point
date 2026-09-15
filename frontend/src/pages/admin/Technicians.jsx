import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import AdminLayout from "./AdminLayout";
import { listTechnicians } from "../../services/adminService";
import { register } from "../../services/authService";
import { getErrorMessage } from "../../services/api";

const STATUS_STYLES = {
  AVAILABLE: "bg-signal-100 text-signal-700 border-signal-200",
  BUSY: "bg-amber-100 text-amber-700 border-amber-200",
  OFFLINE: "bg-ink-100 text-ink-500 border-ink-200",
};

export default function Technicians() {
  const { t } = useTranslation();
  const [technicians, setTechnicians] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal State
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

  const fetchTechnicians = () => {
    setLoading(true);
    listTechnicians(false)
      .then((data) => setTechnicians(data.technicians))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTechnicians();
  }, []);

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
        fetchTechnicians();
      }, 1200);
    } catch (err) {
      setTechModalError(getErrorMessage(err));
    } finally {
      setTechSubmitting(false);
    }
  };

  return (
    <AdminLayout onOpenAddTechnician={() => setShowAddTechModal(true)}>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t("nav.technicians")}</h1>
          <p className="text-xs font-normal text-slate-500 mt-1">Manage field technicians and view availability</p>
        </div>

        <button
          onClick={() => setShowAddTechModal(true)}
          className="btn-primary"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>+ {t("admin.add_technician")}</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 p-4 text-xs font-medium text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-xs font-medium text-slate-400">{t("common.loading")}</p>
        ) : technicians.length === 0 ? (
          <p className="p-8 text-center text-xs font-medium text-slate-400">{t("common.no_data")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="border-b border-slate-100 bg-slate-50 font-semibold uppercase tracking-wider text-slate-500 text-[11px]">
                <tr>
                  <th className="px-5 py-4">{t("admin.technician_name")}</th>
                  <th className="px-5 py-4">{t("auth.phone")}</th>
                  <th className="px-5 py-4">{t("admin.skills")}</th>
                  <th className="px-5 py-4">{t("admin.service_area")}</th>
                  <th className="px-5 py-4">{t("technician.availability_status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {technicians.map((tech) => (
                  <tr key={tech.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4 font-bold text-slate-900">{tech.name}</td>
                    <td className="px-5 py-4 text-slate-600 font-medium">{tech.phone || "—"}</td>
                    <td className="px-5 py-4 text-slate-600 font-medium">{tech.skills || "—"}</td>
                    <td className="px-5 py-4 text-slate-600 font-medium">{tech.service_area || "—"}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                          STATUS_STYLES[tech.availability_status] || "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${tech.availability_status === 'AVAILABLE' ? 'bg-emerald-500' : tech.availability_status === 'BUSY' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                        {t(`status.${tech.availability_status}`) !== `status.${tech.availability_status}` ? t(`status.${tech.availability_status}`) : tech.availability_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD TECHNICIAN MODAL */}
      {showAddTechModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>+ {t("admin.add_technician")}</span>
              </h3>
              <button
                onClick={() => setShowAddTechModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {techModalError && (
              <div className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
                {techModalError}
              </div>
            )}

            {techModalSuccess && (
              <div className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700 border border-emerald-200">
                {techModalSuccess}
              </div>
            )}

            <form onSubmit={handleAddTechnicianSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">{t("auth.name")}</label>
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
                <label className="block text-slate-700 font-semibold mb-1">{t("auth.email")}</label>
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
                <label className="block text-slate-700 font-semibold mb-1">{t("auth.phone")}</label>
                <input
                  type="text"
                  value={techFormData.phone}
                  onChange={(e) => setTechFormData({ ...techFormData, phone: e.target.value })}
                  placeholder="e.g. +1 234 567 890"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">{t("auth.password")}</label>
                <input
                  type="password"
                  required
                  value={techFormData.password}
                  onChange={(e) => setTechFormData({ ...techFormData, password: e.target.value })}
                  placeholder="••••••••"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">{t("admin.skills")}</label>
                <input
                  type="text"
                  value={techFormData.skills}
                  onChange={(e) => setTechFormData({ ...techFormData, skills: e.target.value })}
                  placeholder="e.g. Laptop repair, Screen replacement"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">{t("admin.service_area")}</label>
                <input
                  type="text"
                  value={techFormData.service_area}
                  onChange={(e) => setTechFormData({ ...techFormData, service_area: e.target.value })}
                  placeholder="e.g. Downtown, Zone A"
                  className="input"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
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
                  {techSubmitting ? t("common.submitting") : t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
