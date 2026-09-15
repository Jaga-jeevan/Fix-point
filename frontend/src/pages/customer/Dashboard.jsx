import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../../components/Layout";
import StatusBadge from "../../components/StatusBadge";
import { listMyRepairs } from "../../services/customerService";
import { getErrorMessage } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    listMyRepairs()
      .then((data) => {
        if (!isMounted) return;
        const fetchedRepairs = data.repairs || [];
        const uniqueRepairs = [];
        const seenIds = new Set();
        for (const r of fetchedRepairs) {
          if (r && r.id && !seenIds.has(r.id)) {
            seenIds.add(r.id);
            uniqueRepairs.push(r);
          }
        }
        setRepairs(uniqueRepairs);
      })
      .catch((err) => {
        if (isMounted) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const active = repairs.filter((r) => !["COMPLETED", "REJECTED"].includes(r.status));
  const completed = repairs.filter((r) => r.status === "COMPLETED");

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getDeviceName = (device) => {
    if (!device) return "";
    const brand = device.brand?.trim() || "";
    const model = device.model?.trim() || "";
    if (brand && model) return `${brand} ${model}`;
    return brand || model || "";
  };

  return (
    <Layout>
      {/* WELCOME BACK BANNER */}
      <div className="mb-6 rounded-2xl bg-[#0E1726] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs border border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-800/80 border border-slate-700/60 px-3 py-1 text-[11px] font-medium text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>{t("customer.console")}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-3">
            {t("customer.welcome_back", { name: user?.name?.split(" ")[0] || "Customer" })}
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 font-normal mt-2 max-w-xl leading-relaxed">
            {t("customer.dashboard_subtitle")}
          </p>
        </div>

        <Link
          to="/customer/repairs/new"
          className="btn-primary flex-shrink-0 flex items-center justify-center gap-2 py-3 px-5 text-xs font-bold shadow-md shadow-blue-600/20 self-start md:self-auto"
        >
          <span>+</span>
          <span>{t("nav.new_repair")}</span>
        </Link>
      </div>

      {error && <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 font-medium">{error}</div>}

      <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="card p-5 border-l-4 border-l-slate-400 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">{t("admin.total_repairs")}</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{repairs.length}</p>
        </div>
        <div className="card p-5 border-l-4 border-l-blue-500 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">{t("customer.active_repairs")}</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{active.length}</p>
        </div>
        <div className="card p-5 border-l-4 border-l-emerald-500 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">{t("customer.completed_repairs", "Completed Repairs")}</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{completed.length}</p>
        </div>
      </div>

      <div className="card p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">{t("nav.my_repairs")}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{t("customer.recent_requests_subtitle")}</p>
          </div>
          <Link to="/customer/repairs" className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1 self-start sm:self-auto">
            <span>{t("customer.view_all_repairs", "View All Repairs")} →</span>
          </Link>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400">{t("common.loading")}</div>
        ) : repairs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 sm:p-10 text-center flex flex-col items-center justify-center">
            <div className="h-12 w-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 text-xl mb-3">
              🔧
            </div>
            <h3 className="text-base font-bold text-slate-900">{t("customer.no_repairs_title", "No Repairs Yet")}</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {t("customer.no_repairs_subtitle", "You haven't submitted any repair service requests.")}
            </p>
            <Link
              to="/customer/repairs/new"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
            >
              <span>{t("customer.create_new_repair", "Create New Repair Request")} →</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-3.5">
            {repairs.slice(0, 5).map((r) => {
              const deviceName = getDeviceName(r.device);
              const formattedDate = formatDate(r.preferred_date || r.created_at);
              const deviceType = r.device?.device_type || r.device_type || "";
              const description = r.problem_description || r.issue_description || t("customer.no_description", "No description provided.");
              const tech = r.technician || r.assignment?.technician;

              return (
                <Link
                  key={r.id}
                  to={`/customer/repairs/${r.id}`}
                  className="block rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 hover:border-blue-300 hover:shadow-md transition-all group shadow-2xs space-y-2.5"
                >
                  {/* TOP ROW */}
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {t("customer.request_id", "Request")} #{r.id}
                      {deviceName ? ` — ${deviceName}` : ""}
                    </h3>
                    <StatusBadge status={r.status} />
                  </div>

                  {/* SECOND ROW */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    {(formattedDate || deviceType) && (
                      <span className="text-slate-400 font-medium">
                        {formattedDate}
                        {formattedDate && deviceType ? " · " : ""}
                        {deviceType}
                      </span>
                    )}
                    {tech && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50/80 px-2.5 py-1 text-[11px] font-bold text-blue-900 border border-blue-100">
                        <span>👤 {tech.name}</span>
                      </span>
                    )}
                  </div>

                  {/* THIRD ROW */}
                  <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-100">
                    <p className="text-xs sm:text-sm text-slate-600 font-normal line-clamp-1 flex-1">
                      {description}
                    </p>
                    <span className="text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1 shrink-0">
                      {t("common.view", "View")} →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
