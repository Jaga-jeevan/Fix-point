import React from "react";
import { useTranslation } from "react-i18next";

const STYLES = {
  REQUESTED: { bg: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-500" },
  PENDING_ASSIGNMENT: { bg: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-500" },
  APPROVED: { bg: "bg-amber-50 text-amber-700 border-amber-200/60", dot: "bg-amber-500" },
  REJECTED: { bg: "bg-rose-50 text-rose-700 border-rose-200/60", dot: "bg-rose-500" },
  ASSIGNED: { bg: "bg-blue-50 text-blue-700 border-blue-200/60", dot: "bg-blue-500" },
  ACCEPTED: { bg: "bg-blue-50 text-blue-700 border-blue-200/60", dot: "bg-blue-500" },
  DIAGNOSING: { bg: "bg-amber-50 text-amber-700 border-amber-200/60", dot: "bg-amber-500" },
  QUOTATION_PENDING: { bg: "bg-amber-50 text-amber-700 border-amber-200/60", dot: "bg-amber-500" },
  QUOTATION_APPROVED: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200/60", dot: "bg-emerald-500" },
  QUOTATION_REJECTED: { bg: "bg-rose-50 text-rose-700 border-rose-200/60", dot: "bg-rose-500" },
  IN_PROGRESS: { bg: "bg-blue-50 text-blue-700 border-blue-200/60", dot: "bg-blue-500" },
  ON_THE_WAY: { bg: "bg-amber-50 text-amber-700 border-amber-200/60", dot: "bg-amber-500" },
  DEVICE_RECEIVED: { bg: "bg-amber-50 text-amber-700 border-amber-200/60", dot: "bg-amber-500" },
  REPAIRING: { bg: "bg-amber-50 text-amber-700 border-amber-200/60", dot: "bg-amber-500" },
  PAYMENT_DONE: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200/60", dot: "bg-emerald-500" },
  READY_FOR_DELIVERY: { bg: "bg-amber-50 text-amber-700 border-amber-200/60", dot: "bg-amber-500" },
  COMPLETED: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200/60", dot: "bg-emerald-500" },
  CANCELLED: { bg: "bg-rose-50 text-rose-700 border-rose-200/60", dot: "bg-rose-500" },
  AVAILABLE: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200/60", dot: "bg-emerald-500" },
  BUSY: { bg: "bg-amber-50 text-amber-700 border-amber-200/60", dot: "bg-amber-500" },
  OFFLINE: { bg: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
};

export default function StatusBadge({ status }) {
  const { t } = useTranslation();
  const styleConfig = STYLES[status] || { bg: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-500" };
  const translated = t(`status.${status}`);
  const label = translated !== `status.${status}` ? translated : status ? status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : "";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold ${styleConfig.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${styleConfig.dot}`} />
      {label}
    </span>
  );
}
