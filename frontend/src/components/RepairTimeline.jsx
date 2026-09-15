import React from "react";
import { useTranslation } from "react-i18next";

const FLOW_STATUSES = [
  "REQUESTED",
  "APPROVED",
  "ASSIGNED",
  "ACCEPTED",
  "ON_THE_WAY",
  "DEVICE_RECEIVED",
  "REPAIRING",
  "PAYMENT_DONE",
  "COMPLETED",
];

export default function RepairTimeline({ status, history = [], quotation }) {
  const { t } = useTranslation();

  if (status === "REJECTED") {
    const rejectedEntry = history.find((h) => h.status === "REJECTED");
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {t("status.REJECTED")}
        {rejectedEntry?.remarks ? ` Reason: ${rejectedEntry.remarks}` : ""}
      </div>
    );
  }

  let currentIndex = FLOW_STATUSES.indexOf(status);
  if (currentIndex === -1) {
    if (status === "REPAIR_COMPLETED") currentIndex = FLOW_STATUSES.indexOf("REPAIRING");
    else currentIndex = 0;
  }

  const historyByStatus = Object.fromEntries(history.map((h) => [h.status, h]));

  return (
    <ol className="space-y-4">
      {FLOW_STATUSES.map((st, idx) => {
        let done = idx <= currentIndex && currentIndex !== -1;
        if (st === "PAYMENT_DONE") {
          const isVerified =
            quotation?.payment_status === "PAID" ||
            !!historyByStatus["PAYMENT_DONE"] ||
            !!historyByStatus["PAID"];
          done = isVerified;
        }

        const isCurrent = idx === currentIndex && status !== "COMPLETED";

        let entry = historyByStatus[st];
        if (!entry && st === "PAYMENT_DONE" && quotation?.payment_status === "PAID" && (quotation?.verified_at || quotation?.payment_date)) {
          entry = { created_at: quotation.verified_at || quotation.payment_date };
        }

        const label = t(`status.${st}`) !== `status.${st}` ? t(`status.${st}`) : (st === "PAYMENT_DONE" ? "Payment Done" : st);

        return (
          <li key={st} className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                done
                  ? isCurrent
                    ? "bg-amber-400 text-white"
                    : "bg-emerald-600 text-white"
                  : "border border-slate-200 bg-white text-slate-300"
              }`}
            >
              {done && !isCurrent ? "✓" : idx + 1}
            </span>
            <div>
              <p className={`text-sm font-medium ${done ? "text-ink-800" : "text-ink-400"}`}>
                {label}
              </p>
              {entry?.created_at && (
                <p className="text-xs text-ink-400">
                  {new Date(entry.created_at).toLocaleString()}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
