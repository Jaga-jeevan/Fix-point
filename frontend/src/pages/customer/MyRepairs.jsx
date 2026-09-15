import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../../components/Layout";
import StatusBadge from "../../components/StatusBadge";
import { listMyRepairs } from "../../services/customerService";
import { getErrorMessage } from "../../services/api";

export default function MyRepairs() {
  const [repairs, setRepairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { t } = useTranslation();

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

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t("nav.my_repairs")}</h1>
          <p className="text-xs text-slate-400 mt-1 font-normal">{t("customer.my_repairs_subtitle")}</p>
        </div>
        <Link to="/customer/repairs/new" className="btn-primary">
          + {t("nav.new_repair")}
        </Link>
      </div>

      {error && <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 font-medium">{error}</div>}

      <div className="card overflow-hidden shadow-xs">
        {loading ? (
          <p className="p-6 text-xs text-slate-400">{t("common.loading")}</p>
        ) : repairs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-xs font-semibold text-slate-500">{t("customer.no_repairs")}</p>
            <Link to="/customer/repairs/new" className="mt-2 inline-block text-xs font-semibold text-blue-600 hover:underline">
              {t("nav.new_repair")} →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[11px] font-bold">
                <tr>
                  <th className="px-5 py-4">ID</th>
                  <th className="px-5 py-4">{t("customer.device_type")}</th>
                  <th className="px-5 py-4">{t("customer.preferred_date")}</th>
                  <th className="px-5 py-4">{t("common.status")}</th>
                  <th className="px-5 py-4">{t("customer.assigned_technician", "Assigned Technician")}</th>
                  <th className="px-5 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {repairs.map((r) => {
                  const tech = r.technician || r.assignment?.technician;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4 font-bold text-slate-900">#{r.id}</td>
                      <td className="px-5 py-4 font-bold text-slate-900">
                        {r.device?.brand} {r.device?.model}
                      </td>
                      <td className="px-5 py-4 text-slate-400">{r.preferred_date}</td>
                      <td className="px-5 py-4">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-5 py-4">
                        {tech ? (
                          <div>
                            <p className="font-bold text-slate-900 text-xs flex items-center gap-1">
                              <span>👤</span> {tech.name}
                            </p>
                            {tech.phone && (
                              <a href={`tel:${tech.phone}`} className="text-[11px] font-semibold text-blue-600 hover:underline">
                                📱 {tech.phone}
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          to={`/customer/repairs/${r.id}`}
                          className="btn-outline text-[11px] px-3.5 py-1.5 rounded-xl"
                        >
                          {t("common.view_details")} →
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
    </Layout>
  );
}
