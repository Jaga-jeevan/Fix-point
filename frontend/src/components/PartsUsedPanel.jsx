import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listPartsUsed, addPartUsed, updatePartUsed, removePartUsed } from "../services/partsService";
import { getErrorMessage } from "../services/api";

export default function PartsUsedPanel({ repairId, canEdit }) {
  const { t } = useTranslation();
  const [partsUsed, setPartsUsed] = useState([]);
  const [total, setTotal] = useState(0);

  // Manual Form States
  const [partDetails, setPartDetails] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    listPartsUsed(repairId)
      .then((data) => {
        setPartsUsed(data.parts_used || []);
        setTotal(data.total || 0);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [repairId]);

  // Compute total dynamically from partsUsed array
  const calculatedTotal = partsUsed.reduce(
    (sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.unit_price) || 0),
    0
  );

  function handleStartEdit(part) {
    setEditingId(part.id);
    setPartDetails(part.part_name || "");
    setQuantity(part.quantity || 1);
    setPrice(part.unit_price !== undefined ? part.unit_price : "");
    setError("");
  }

  function handleCancelEdit() {
    setEditingId(null);
    setPartDetails("");
    setQuantity(1);
    setPrice("");
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const detailsTrimmed = partDetails.trim();
    if (!detailsTrimmed) {
      setError("Please enter part details.");
      return;
    }

    const qtyNum = parseInt(quantity, 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError("Quantity must be greater than 0.");
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setError("Please enter a valid price (₹).");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updatePartUsed(repairId, editingId, {
          part_details: detailsTrimmed,
          part_name: detailsTrimmed,
          quantity: qtyNum,
          price: priceNum,
          unit_price: priceNum,
        });
      } else {
        await addPartUsed(repairId, {
          part_details: detailsTrimmed,
          part_name: detailsTrimmed,
          quantity: qtyNum,
          price: priceNum,
          unit_price: priceNum,
        });
      }

      handleCancelEdit();
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(partUsedId) {
    if (!window.confirm("Are you sure you want to remove this part?")) return;
    setError("");
    setSaving(true);
    try {
      await removePartUsed(repairId, partUsedId);
      if (editingId === partUsedId) {
        handleCancelEdit();
      }
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 font-sans">
      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700 font-medium">
          {error}
        </div>
      )}

      {/* FORM FOR ADDING / EDITING PART DETAILS (Shown when technician canEdit is true) */}
      {canEdit && (
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-3.5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {editingId ? "Edit Part Details" : "PARTS USED"}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* PART DETAILS INPUT */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Part Details
              </label>
              <input
                type="text"
                value={partDetails}
                onChange={(e) => setPartDetails(e.target.value)}
                placeholder="Enter part details"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                required
              />
            </div>

            {/* QUANTITY & PRICE INPUTS */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Price
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-xs font-bold text-slate-500 pointer-events-none">
                    ₹
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Enter price"
                    className="w-full rounded-xl border border-slate-200 bg-white pl-7 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-semibold"
                    required
                  />
                </div>
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={saving || !partDetails.trim() || price === ""}
                className="w-full rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
              >
                {saving
                  ? "Saving..."
                  : editingId
                  ? "Update Part"
                  : "Add Part"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LIST OF ADDED PARTS */}
      <div>
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
          Added Parts
        </h4>

        {loading ? (
          <p className="text-xs text-slate-400 font-medium">Loading parts...</p>
        ) : partsUsed.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center">
            <p className="text-xs text-slate-400 font-medium">No parts added yet.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {partsUsed.map((p) => {
              const unitPriceNum = Number(p.unit_price || 0);
              return (
                <div
                  key={p.id}
                  className={`rounded-2xl border bg-white p-3.5 transition-all shadow-2xs ${
                    editingId === p.id ? "border-blue-500 ring-2 ring-blue-500/10" : "border-slate-200/80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1">
                      <h5 className="text-xs font-bold text-slate-900 leading-snug">
                        {p.part_name || p.name || "Part"}
                      </h5>
                      <div className="flex flex-col gap-0.5 text-[11px] text-slate-500 font-medium">
                        <p>
                          Quantity: <strong className="text-slate-800">{p.quantity}</strong>
                        </p>
                        <p>
                          Price: <strong className="text-slate-800">₹{unitPriceNum.toLocaleString("en-IN")}</strong>
                        </p>
                      </div>
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(p)}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(p.id)}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-colors cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* TOTAL PARTS COST DISPLAY */}
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Total Parts Cost
              </span>
              <span className="text-sm font-extrabold text-emerald-400">
                ₹{(calculatedTotal || total).toLocaleString("en-IN", { minimumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

