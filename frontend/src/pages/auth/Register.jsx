import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { getErrorMessage } from "../../services/api";
import LanguageSelector from "../../components/LanguageSelector";
import Logo from "../../components/Logo";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "CUSTOMER",
    skills: "",
    service_area: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await register(form);
      setSuccess(t("common.success"));
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-ink-50 px-4 py-10">
      <div className="absolute top-4 right-4 z-10">
        <LanguageSelector />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Logo size="lg" className="mx-auto mb-3 shadow-lg shadow-purple-500/30" />
          <h1 className="font-display text-xl font-semibold text-ink-800">{t("auth.register_title")}</h1>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {success && (
            <div className="rounded-md bg-signal-50 px-3 py-2 text-sm text-signal-700">{success}</div>
          )}

          <div>
            <label className="label">{t("auth.role")}</label>
            <div className="grid grid-cols-2 gap-2">
              {["CUSTOMER", "TECHNICIAN"].map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => update("role", r)}
                  className={`rounded-md border px-3 py-2 text-sm font-medium ${
                    form.role === r
                      ? "border-ink-800 bg-ink-800 text-white"
                      : "border-ink-200 text-ink-600 hover:bg-ink-100"
                  }`}
                >
                  {r === "CUSTOMER" ? t("auth.customer_role") : t("auth.technician_role")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">{t("auth.name")}</label>
            <input
              required
              className="input"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>

          <div>
            <label className="label">{t("auth.email")}</label>
            <input
              type="email"
              required
              className="input"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </div>

          <div>
            <label className="label">{t("auth.phone")}</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
            />
          </div>

          <div>
            <label className="label">{t("auth.password")}</label>
            <input
              type="password"
              required
              minLength={6}
              className="input"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
            />
          </div>

          {form.role === "TECHNICIAN" && (
            <>
              <div>
                <label className="label">{t("admin.skills")}</label>
                <input
                  className="input"
                  placeholder="e.g. Laptop, Mobile repair"
                  value={form.skills}
                  onChange={(e) => update("skills", e.target.value)}
                />
              </div>
              <div>
                <label className="label">{t("admin.service_area")}</label>
                <input
                  className="input"
                  placeholder="e.g. Chennai Central"
                  value={form.service_area}
                  onChange={(e) => update("service_area", e.target.value)}
                />
              </div>
            </>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? t("common.submitting") : t("auth.sign_up")}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-ink-500">
          {t("auth.has_account")}{" "}
          <Link to="/login" className="font-medium text-ink-800 hover:underline">
            {t("auth.login_here")}
          </Link>
        </p>
      </div>
    </div>
  );
}
