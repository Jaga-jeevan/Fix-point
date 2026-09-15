import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listActions, addAction } from "../services/repairActionsService";
import { getErrorMessage } from "../services/api";

export default function RepairActionsPanel({ repairId, canEdit }) {
  const { t } = useTranslation();
  const [actions, setActions] = useState([]);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function load() {
    listActions(repairId)
      .then((data) => setActions(data.actions))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(load, [repairId]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!description.trim()) return;
    setSaving(true);
    setError("");
    try {
      await addAction(repairId, description.trim());
      setDescription("");
      load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {error && <div className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <p className="text-sm text-ink-400">{t("common.loading")}</p>
      ) : actions.length === 0 ? (
        <p className="text-sm text-ink-400">{t("common.no_data")}</p>
      ) : (
        <ul className="space-y-2">
          {actions.map((a) => (
            <li key={a.id} className="flex items-start gap-2 text-sm text-ink-700">
              <span className="mt-0.5 text-signal-600">✓</span>
              <div>
                <p>{a.description}</p>
                <p className="text-xs text-ink-400">{new Date(a.created_at).toLocaleString()}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={handleAdd} className="mt-4 flex gap-2">
          <input
            className="input"
            placeholder={t("customer.problem_placeholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button type="submit" disabled={saving} className="btn-primary whitespace-nowrap">
            {t("common.save")}
          </button>
        </form>
      )}
    </div>
  );
}
