import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getQuotation,
  saveQuotation,
  sendQuotation,
  approveQuotation,
  rejectQuotation,
  requestQuotationRevision,
  submitPayment,
  verifyPayment,
} from "../services/quotationService";
import { getErrorMessage } from "../services/api";

const STATUS_STYLES = {
  DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
  SENT: "bg-amber-50 text-amber-700 border-amber-200/60",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200/60",
  REVISION_REQUESTED: "bg-amber-100 text-amber-900 border-amber-300 font-bold",
  REVISED_SENT: "bg-blue-50 text-blue-700 border-blue-200/60 font-bold",
};

const REVISION_REASON_OPTIONS = [
  "Cost is too high",
  "Remove some parts",
  "Request a discount",
  "Other",
];

function emptyItem() {
  return { part_name: "", quantity: 1, unit_price: 0 };
}

export default function QuotationPanel({ repairId, role, onUpdate }) {
  const { t } = useTranslation();
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [diagnosis, setDiagnosis] = useState("");
  const [labourCost, setLabourCost] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [items, setItems] = useState([emptyItem()]);

  // Revision Modal State (Customer side)
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionReason, setRevisionReason] = useState("Cost is too high");
  const [revisionMessage, setRevisionMessage] = useState("");
  const [revisionSubmitting, setRevisionSubmitting] = useState(false);
  const [revisionError, setRevisionError] = useState("");

  // Payment Modal State
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [utrInput, setUtrInput] = useState("");
  const [payError, setPayError] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [verifySubmitting, setVerifySubmitting] = useState(false);

  // Toggle History View
  const [showHistory, setShowHistory] = useState(false);

  function load() {
    getQuotation(repairId)
      .then((data) => {
        setQuotation(data.quotation);
        if (data.quotation) {
          setDiagnosis(data.quotation.diagnosis || "");
          setLabourCost(data.quotation.labour_cost || 0);
          setDiscount(data.quotation.discount || 0);
          setItems(
            data.quotation.items?.length
              ? data.quotation.items.map((i) => ({
                  part_name: i.part_name,
                  quantity: i.quantity,
                  unit_price: i.unit_price,
                }))
              : [emptyItem()]
          );
        }
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, [repairId]);

  function updateItem(idx, field, value) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }

  function addItemRow() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItemRow(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSaveDraft(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveQuotation(repairId, {
        diagnosis,
        labour_cost: Number(labourCost),
        discount: 0,
        items: items.filter((i) => i.part_name.trim()),
      });
      load();
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    setSaving(true);
    setError("");
    try {
      await sendQuotation(repairId);
      load();
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    setSaving(true);
    setError("");
    try {
      await approveQuotation(repairId);
      load();
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleReject() {
    setSaving(true);
    setError("");
    try {
      await rejectQuotation(repairId);
      load();
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestRevisionSubmit(e) {
    e.preventDefault();
    setRevisionSubmitting(true);
    setRevisionError("");
    try {
      await requestQuotationRevision(repairId, {
        reason: revisionReason,
        message: revisionMessage,
      });
      setShowRevisionModal(false);
      setRevisionMessage("");
      load();
      if (onUpdate) onUpdate();
    } catch (err) {
      setRevisionError(getErrorMessage(err));
    } finally {
      setRevisionSubmitting(false);
    }
  }

  async function handlePaymentSubmit(e) {
    e.preventDefault();
    if (paymentMethod === "UPI") {
      const code = utrInput.trim();
      if (!code) {
        setPayError("Transaction ID / UTR is required.");
        return;
      }
      setPaySubmitting(true);
      setPayError("");
      try {
        await submitPayment(repairId, { payment_method: "UPI", utr: code });
        setShowPayModal(false);
        setUtrInput("");
        load();
        if (onUpdate) onUpdate();
      } catch (err) {
        setPayError(getErrorMessage(err));
      } finally {
        setPaySubmitting(false);
      }
    } else {
      setPaySubmitting(true);
      setPayError("");
      try {
        await submitPayment(repairId, { payment_method: "CASH" });
        setShowPayModal(false);
        load();
        if (onUpdate) onUpdate();
      } catch (err) {
        setPayError(getErrorMessage(err));
      } finally {
        setPaySubmitting(false);
      }
    }
  }

  async function handleVerifyPayment() {
    setVerifySubmitting(true);
    setError("");
    try {
      await verifyPayment(repairId);
      load();
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setVerifySubmitting(false);
    }
  }

  if (loading) return <p className="text-xs text-slate-400">{t("common.loading")}</p>;

  if (error) {
    return <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">{error}</div>;
  }

  // =========================================================================
  // CUSTOMER VIEW
  // =========================================================================
  if (role === "CUSTOMER") {
    if (!quotation) {
      return <p className="text-xs text-slate-400">{t("quotation.pending_approval")}</p>;
    }

    const isPendingCustomerAction = ["SENT", "REVISED_SENT"].includes(quotation.status);

    return (
      <div className="space-y-4 font-sans">
        {/* HEADER BADGES */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold border ${STATUS_STYLES[quotation.status] || STATUS_STYLES.DRAFT}`}>
              {quotation.status === "REVISION_REQUESTED"
                ? "Revision Requested"
                : quotation.status === "REVISED_SENT"
                ? "Revised Quotation Received"
                : t(`status.QUOTATION_${quotation.status}`) !== `status.QUOTATION_${quotation.status}`
                ? t(`status.QUOTATION_${quotation.status}`)
                : quotation.status}
            </span>
            {quotation.version > 1 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                v{quotation.version} (Revised)
              </span>
            )}
          </div>

          {quotation.payment_status === "PAID" && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              ✓ {t("status.PAID").toUpperCase()}
            </span>
          )}
        </div>

        {/* REVISION REQUESTED CUSTOMER BANNER */}
        {quotation.status === "REVISION_REQUESTED" && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping" />
              <span>Revision Request Submitted to Technician</span>
            </div>
            {quotation.revision_reason && (
              <p className="text-amber-800 font-medium">
                <span className="font-bold">Reason:</span> {quotation.revision_reason}
              </p>
            )}
            {quotation.revision_message && (
              <p className="text-amber-800 italic bg-amber-100/60 p-2 rounded-lg border border-amber-200/60">
                "{quotation.revision_message}"
              </p>
            )}
            <p className="text-[11px] text-amber-700">
              The technician is reviewing your request and will send an updated quotation shortly.
            </p>
          </div>
        )}

        {/* DIAGNOSIS */}
        {quotation.diagnosis && (
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t("quotation.item_description")}</p>
            <p className="text-xs font-medium text-slate-800 mt-0.5">{quotation.diagnosis}</p>
          </div>
        )}

        {/* ITEMIZED QUOTATION BREAKDOWN */}
        <div className="space-y-2 text-xs">
          <div className="flex justify-between font-bold text-slate-400 text-[11px] uppercase tracking-wider pb-1 border-b border-slate-100">
            <span className="flex-1">Part Name</span>
            <span className="w-20 text-center">Units</span>
            <span className="w-28 text-right">Price</span>
          </div>
          {quotation.items.map((item) => (
            <div key={item.id} className="flex justify-between items-center text-slate-700 py-0.5">
              <span className="flex-1 font-medium">{item.part_name}</span>
              <span className="w-20 text-center text-slate-500 font-medium">{item.quantity} {item.quantity === 1 ? "unit" : "units"}</span>
              <span className="w-28 text-right font-semibold text-slate-900">₹{item.line_total.toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between text-slate-700 pt-1 border-t border-slate-100">
            <span>{t("quotation.labor_fee")}</span>
            <span className="font-semibold text-slate-900">₹{quotation.labour_cost.toFixed(2)}</span>
          </div>

          <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
            <span>{t("quotation.total_amount")}</span>
            <span className="text-blue-600">₹{quotation.total_amount.toFixed(2)}</span>
          </div>
        </div>

        {/* CUSTOMER QUOTATION ACTIONS */}
        {isPendingCustomerAction && (
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={handleApprove}
                disabled={saving}
                className="btn-primary bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-bold shadow-xs"
              >
                ✓ {t("quotation.approve")}
              </button>

              <button
                onClick={() => setShowRevisionModal(true)}
                disabled={saving}
                className="btn-outline border-amber-300 text-amber-900 bg-amber-50/60 hover:bg-amber-100/80 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <span>✏️</span>
                <span>Request Revised Quotation</span>
              </button>
            </div>
          </div>
        )}

        {/* PAYMENT SECTION */}
        {quotation.status === "APPROVED" && (
          <div className="pt-3 border-t border-slate-100 space-y-3">
            {quotation.payment_status === "UNPAID" && (
              <button
                onClick={() => {
                  setShowPayModal(true);
                  setPaymentMethod("UPI");
                }}
                className="btn-primary w-full py-2.5 text-xs shadow-md shadow-blue-600/15"
              >
                {t("quotation.pay_now")} →
              </button>
            )}

            {quotation.payment_status === "PENDING_VERIFICATION" && (
              <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-4 space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="font-bold text-amber-900 uppercase tracking-wider text-[11px]">
                    {t("quotation.payment_pending_verification")}
                  </span>
                </div>
                <p className="text-amber-800 text-xs font-normal">
                  {quotation.payment_method === "CASH"
                    ? t("quotation.cash_pending_msg")
                    : t("quotation.upi_pending_msg")}
                </p>
                {quotation.payment_method && (
                  <p className="text-slate-700 font-mono text-[11px] pt-1">
                    <span className="font-semibold text-slate-500 font-sans uppercase">{t("quotation.payment_method")}:</span>{" "}
                    {quotation.payment_method === "CASH" ? t("quotation.cash_payment") : t("quotation.upi_qr")}
                  </p>
                )}
                {quotation.utr && (
                  <p className="text-slate-700 font-mono text-[11px]">
                    <span className="font-semibold text-slate-500 font-sans uppercase">{t("quotation.payment_ref_utr")}:</span> {quotation.utr}
                  </p>
                )}
              </div>
            )}

            {quotation.payment_status === "PAID" && (
              <div className="rounded-xl bg-emerald-50/80 border border-emerald-200/80 p-4 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                  <span>✓</span>
                  <span>{t("quotation.payment_verified_paid")}</span>
                </div>
                <p className="text-emerald-900 font-mono text-[11px] pt-1">
                  <span className="font-semibold text-emerald-700 font-sans uppercase">{t("quotation.payment_method")}:</span>{" "}
                  {quotation.payment_method === "CASH" ? t("quotation.cash") : t("quotation.upi_qr")}
                </p>
                {quotation.utr && (
                  <p className="text-emerald-900 font-mono text-[11px]">
                    <span className="font-semibold text-emerald-700 font-sans uppercase">{t("quotation.utr_transaction_id")}:</span> {quotation.utr}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* QUOTATION HISTORY SECTION */}
        {quotation.history && quotation.history.length > 0 && (
          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs font-bold text-slate-600 hover:text-blue-600 flex items-center justify-between w-full py-1"
            >
              <span>📜 Quotation Version History ({quotation.history.length})</span>
              <span>{showHistory ? "▲" : "▼"}</span>
            </button>

            {showHistory && (
              <div className="mt-2 space-y-2.5">
                {quotation.history.map((h) => (
                  <div key={h.id} className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">Version #{h.version}</span>
                      <span className="text-[10px] text-slate-400">{h.created_at ? new Date(h.created_at).toLocaleDateString() : ""}</span>
                    </div>
                    {h.revision_reason && (
                      <p className="text-slate-600 text-[11px]">
                        <span className="font-semibold text-rose-700">Rejected / Revision Reason:</span> {h.revision_reason}
                      </p>
                    )}
                    {h.revision_message && (
                      <p className="text-slate-600 italic text-[11px] bg-white p-1.5 rounded border border-slate-100">
                        "{h.revision_message}"
                      </p>
                    )}
                    <div className="text-[11px] space-y-0.5 pt-1 border-t border-slate-200/60">
                      {h.items && h.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-slate-600">
                          <span>{it.part_name} × {it.quantity}</span>
                          <span>₹{(it.line_total || it.quantity * it.unit_price).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-slate-600">
                        <span>Labour Fee</span>
                        <span>₹{h.labour_cost.toFixed(2)}</span>
                      </div>
                      {h.discount > 0 && (
                        <div className="flex justify-between text-emerald-700">
                          <span>Discount</span>
                          <span>- ₹{h.discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-slate-900 pt-1">
                        <span>Total</span>
                        <span>₹{h.total_amount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* REQUEST REVISION MODAL */}
        {showRevisionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-base text-slate-900">Request Revised Quotation</h3>
                <button
                  onClick={() => {
                    setShowRevisionModal(false);
                    setRevisionError("");
                  }}
                  className="text-slate-400 hover:text-slate-600 text-xl font-medium"
                >
                  ✕
                </button>
              </div>

              {revisionError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
                  {revisionError}
                </div>
              )}

              <form onSubmit={handleRequestRevisionSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Please select a reason for requesting a revision:
                  </label>
                  <div className="space-y-2">
                    {REVISION_REASON_OPTIONS.map((opt) => (
                      <label
                        key={opt}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                          revisionReason === opt
                            ? "border-blue-600 bg-blue-50/70 text-blue-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="revisionReason"
                          value={opt}
                          checked={revisionReason === opt}
                          onChange={(e) => setRevisionReason(e.target.value)}
                          className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Additional Message (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={revisionMessage}
                    onChange={(e) => setRevisionMessage(e.target.value)}
                    placeholder="e.g. Please see if you can reduce the total cost or remove non-essential parts."
                    className="input text-xs resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRevisionModal(false)}
                    className="btn-outline"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={revisionSubmitting}
                    className="btn-primary bg-blue-600 hover:bg-blue-700"
                  >
                    {revisionSubmitting ? t("common.submitting") : "Submit Revision Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CUSTOMER PAYMENT MODAL */}
        {showPayModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-lg text-slate-900">{t("quotation.payment")}</h3>
                <button
                  onClick={() => {
                    setShowPayModal(false);
                    setPayError("");
                  }}
                  className="text-slate-400 hover:text-slate-600 text-xl font-medium"
                >
                  ✕
                </button>
              </div>

              {payError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
                  {payError}
                </div>
              )}

              {/* QUOTATION AMOUNT */}
              <div className="rounded-xl bg-blue-50/60 border border-blue-100 p-4 text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t("quotation.quotation_amount")}</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">₹ {quotation.total_amount.toFixed(2)}</p>
              </div>

              {/* PAYMENT FORM */}
              <form onSubmit={handlePaymentSubmit} className="space-y-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t("quotation.payment_method")}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("UPI")}
                      className={`rounded-xl p-2.5 text-xs font-bold transition flex items-center justify-center gap-2 border ${
                        paymentMethod === "UPI"
                          ? "border-blue-600 bg-blue-50 text-blue-700 shadow-xs"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span>📱</span>
                      <span>{t("quotation.upi_qr")}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod("CASH")}
                      className={`rounded-xl p-2.5 text-xs font-bold transition flex items-center justify-center gap-2 border ${
                        paymentMethod === "CASH"
                          ? "border-blue-600 bg-blue-50 text-blue-700 shadow-xs"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <span>💵</span>
                      <span>{t("quotation.cash_payment")}</span>
                    </button>
                  </div>
                </div>

                {paymentMethod === "UPI" && (
                  <>
                    <div className="text-center space-y-2 py-1">
                      <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">{t("quotation.scan_pay")}</p>
                      <div className="inline-block rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                        <img
                          src="/payment_qr.jpg"
                          alt="Payment QR Code"
                          className="h-[220px] w-[220px] object-contain rounded-xl"
                        />
                      </div>
                      <p className="text-xs text-slate-500 font-normal">{t("quotation.scan_pay_hint")}</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t("quotation.payment_ref_utr")}
                      </label>
                      <input
                        type="text"
                        required
                        value={utrInput}
                        onChange={(e) => setUtrInput(e.target.value)}
                        placeholder={t("quotation.enter_utr_placeholder")}
                        className="input text-xs font-mono font-bold"
                      />
                    </div>
                  </>
                )}

                {paymentMethod === "CASH" && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center space-y-1 my-2">
                    <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">{t("quotation.cash_payment")}</p>
                    <p className="text-xs text-slate-600 font-normal">
                      {t("quotation.cash_collected_hint")}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPayModal(false)}
                    className="btn-outline"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={paySubmitting || (paymentMethod === "UPI" && !utrInput.trim())}
                    className="btn-primary"
                  >
                    {paySubmitting
                      ? t("common.submitting")
                      : paymentMethod === "CASH"
                      ? t("quotation.confirm_cash_payment")
                      : t("quotation.confirm_payment")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // TECHNICIAN / ADMIN VIEW
  // =========================================================================
  const isEditable = !quotation || ["DRAFT", "REVISION_REQUESTED"].includes(quotation.status);

  // Subtotal calculations
  const partsTotal = items.reduce((acc, i) => acc + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);
  const calculatedTotal = Math.max(0, partsTotal + (Number(labourCost) || 0));

  return (
    <div className="space-y-4 font-sans">
      {quotation && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold border ${STATUS_STYLES[quotation.status] || STATUS_STYLES.DRAFT}`}>
              {quotation.status === "REVISION_REQUESTED"
                ? "Customer Requested Revision"
                : quotation.status === "REVISED_SENT"
                ? "Revised Quotation Sent"
                : t(`status.QUOTATION_${quotation.status}`) !== `status.QUOTATION_${quotation.status}`
                ? t(`status.QUOTATION_${quotation.status}`)
                : quotation.status}
            </span>

            {quotation.version > 1 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
                v{quotation.version}
              </span>
            )}
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
              quotation.payment_status === "PAID"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                : quotation.payment_status === "PENDING_VERIFICATION"
                ? "bg-amber-50 text-amber-700 border-amber-200/60"
                : "bg-slate-100 text-slate-600 border-slate-200"
            }`}
          >
            {quotation.payment_status === "PAID"
              ? `✓ ${t("status.PAID").toUpperCase()}`
              : quotation.payment_status === "PENDING_VERIFICATION"
              ? t("quotation.payment_pending_verification").toUpperCase()
              : t("status.UNPAID").toUpperCase()}
          </span>
        </div>
      )}

      {/* TECHNICIAN REVISION REQUESTED ALERT */}
      {quotation && quotation.status === "REVISION_REQUESTED" && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-ping" />
            <span>Customer Requested a Revised Quotation</span>
          </div>
          {quotation.revision_reason && (
            <p className="text-amber-900 font-medium">
              <span className="font-bold">Reason selected by customer:</span> {quotation.revision_reason}
            </p>
          )}
          {quotation.revision_message && (
            <div className="text-amber-900 italic bg-amber-100/70 p-2.5 rounded-xl border border-amber-200">
              <span className="font-semibold not-italic text-amber-950 block mb-0.5">Additional Message:</span>
              "{quotation.revision_message}"
            </div>
          )}
          <p className="text-[11px] text-amber-800">
            You can modify parts and labour fee below, then click <strong>Resend Revised Quotation</strong>.
          </p>
        </div>
      )}

      {/* EDITABLE FORM */}
      {isEditable ? (
        <form onSubmit={handleSaveDraft} className="space-y-4">
          <div>
            <label className="label">{t("customer.problem_description")}</label>
            <textarea
              className="input text-xs"
              rows={2}
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder={t("customer.problem_placeholder")}
            />
          </div>

          <div>
            <label className="label mb-1.5">{t("parts.title")}</label>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
                <span className="col-span-6">Part Name</span>
                <span className="col-span-2 text-center">Units</span>
                <span className="col-span-3 text-center">Price (₹)</span>
                <span className="col-span-1 text-center"></span>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    className="input text-xs col-span-6"
                    placeholder="Part Name"
                    value={item.part_name}
                    onChange={(e) => updateItem(idx, "part_name", e.target.value)}
                  />
                  <input
                    type="number"
                    min={1}
                    className="input text-xs col-span-2 text-center font-medium px-1"
                    placeholder="Units"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="input text-xs col-span-3 text-right font-medium px-2"
                    placeholder="Price (₹)"
                    value={item.unit_price}
                    onChange={(e) => updateItem(idx, "unit_price", e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeItemRow(idx)}
                    className="btn-outline text-xs col-span-1 h-9 flex items-center justify-center p-0 text-rose-600 border-rose-200 hover:bg-rose-50 font-bold"
                    title="Remove item"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" onClick={addItemRow} className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1 mt-1">
                + {t("parts.add_part")}
              </button>
            </div>
          </div>

          <div>
            <label className="label">{t("quotation.labor_fee")}</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="input text-xs"
              value={labourCost}
              onChange={(e) => setLabourCost(e.target.value)}
            />
          </div>

          {/* TOTAL PREVIEW */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Parts Subtotal:</span>
              <span>₹{partsTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Labour Fee:</span>
              <span>₹{(Number(labourCost) || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-1">
              <span>Calculated Total:</span>
              <span className="text-blue-600">₹{calculatedTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="btn-outline text-xs">
              {t("common.save")}
            </button>
            {quotation && (
              <button
                type="button"
                onClick={handleSend}
                disabled={saving}
                className="btn-primary bg-blue-600 hover:bg-blue-700 text-xs font-bold"
              >
                {quotation.status === "REVISION_REQUESTED"
                  ? "Resend Revised Quotation →"
                  : t("technician.submit_quotation")}
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between font-bold text-slate-400 text-[11px] uppercase tracking-wider pb-1 border-b border-slate-100">
              <span className="flex-1">Part Name</span>
              <span className="w-20 text-center">Units</span>
              <span className="w-28 text-right">Price</span>
            </div>
            {quotation.items.map((item) => (
              <div key={item.id} className="flex justify-between items-center text-slate-700 py-0.5">
                <span className="flex-1 font-medium">{item.part_name}</span>
                <span className="w-20 text-center text-slate-500 font-medium">{item.quantity} {item.quantity === 1 ? "unit" : "units"}</span>
                <span className="w-28 text-right font-semibold text-slate-900">₹{item.line_total.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between text-slate-700 pt-1 border-t border-slate-100">
              <span>{t("quotation.labor_fee")}</span>
              <span className="font-semibold text-slate-900">₹{quotation.labour_cost.toFixed(2)}</span>
            </div>

            <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
              <span>{t("quotation.total_amount")}</span>
              <span className="text-blue-600">₹{quotation.total_amount.toFixed(2)}</span>
            </div>
          </div>

          {/* TECHNICIAN / ADMIN PAYMENT VERIFICATION PANEL */}
          {quotation.payment_status === "PENDING_VERIFICATION" && (
            <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-900 uppercase tracking-wider text-[11px]">
                  {t("quotation.payment_status")}: {t("quotation.payment_pending_verification").toUpperCase()}
                </span>
              </div>
              <p className="text-slate-700 font-mono text-xs">
                <span className="font-semibold text-slate-500 font-sans">{t("quotation.payment_method")}:</span>{" "}
                <span className="font-bold">{quotation.payment_method === "CASH" ? t("quotation.cash") : t("quotation.upi_qr")}</span>
              </p>
              {quotation.utr ? (
                <p className="text-slate-800 font-mono text-xs">
                  <span className="font-semibold text-slate-500 font-sans">{t("quotation.utr_transaction_id")}:</span>{" "}
                  <span className="font-bold bg-white px-2 py-0.5 rounded border border-amber-200">{quotation.utr}</span>
                </p>
              ) : (
                <p className="text-amber-800 text-[11px] font-normal">
                  {t("quotation.cash_collection_tech_hint")}
                </p>
              )}
              <button
                onClick={handleVerifyPayment}
                disabled={verifySubmitting}
                className="btn-primary w-full bg-emerald-600 hover:bg-emerald-700 py-2 text-xs mt-2"
              >
                {verifySubmitting ? t("common.verifying") : t("quotation.verify_payment_btn")}
              </button>
            </div>
          )}

          {quotation.payment_status === "PAID" && (
            <div className="rounded-xl bg-emerald-50/80 border border-emerald-200/80 p-3.5 space-y-1 text-xs">
              <p className="font-bold text-emerald-800 flex items-center gap-1.5">
                <span>✓</span>
                <span>{t("quotation.payment_status")}: {t("status.PAID").toUpperCase()}</span>
              </p>
              <p className="text-emerald-900 font-mono text-[11px]">
                <span className="font-semibold text-emerald-700 font-sans">{t("quotation.payment_method")}:</span>{" "}
                {quotation.payment_method === "CASH" ? t("quotation.cash") : t("quotation.upi_qr")}
              </p>
              {quotation.utr && (
                <p className="text-emerald-900 font-mono text-[11px]">
                  <span className="font-semibold text-emerald-700 font-sans">{t("quotation.utr_transaction_id")}:</span> {quotation.utr}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* QUOTATION HISTORY SECTION FOR TECHNICIAN / ADMIN */}
      {quotation && quotation.history && quotation.history.length > 0 && (
        <div className="pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs font-bold text-slate-600 hover:text-blue-600 flex items-center justify-between w-full py-1"
          >
            <span>📜 Quotation Version History ({quotation.history.length})</span>
            <span>{showHistory ? "▲" : "▼"}</span>
          </button>

          {showHistory && (
            <div className="mt-2 space-y-2.5">
              {quotation.history.map((h) => (
                <div key={h.id} className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">Version #{h.version}</span>
                    <span className="text-[10px] text-slate-400">{h.created_at ? new Date(h.created_at).toLocaleDateString() : ""}</span>
                  </div>
                  {h.revision_reason && (
                    <p className="text-slate-600 text-[11px]">
                      <span className="font-semibold text-rose-700">Customer Revision Reason:</span> {h.revision_reason}
                    </p>
                  )}
                  {h.revision_message && (
                    <p className="text-slate-600 italic text-[11px] bg-white p-1.5 rounded border border-slate-100">
                      "{h.revision_message}"
                    </p>
                  )}
                  <div className="text-[11px] space-y-0.5 pt-1 border-t border-slate-200/60">
                    {h.items && h.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-slate-600">
                        <span>{it.part_name} × {it.quantity}</span>
                        <span>₹{(it.line_total || it.quantity * it.unit_price).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-slate-600">
                      <span>Labour Fee</span>
                      <span>₹{h.labour_cost.toFixed(2)}</span>
                    </div>
                    {h.discount > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Discount</span>
                        <span>- ₹{h.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-slate-900 pt-1">
                      <span>Total</span>
                      <span>₹{h.total_amount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

