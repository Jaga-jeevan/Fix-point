import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { getErrorMessage } from "../../services/api";
import LanguageSelector from "../../components/LanguageSelector";
import Logo from "../../components/Logo";

const REDIRECTS = {
  CUSTOMER: "/customer/dashboard",
  TECHNICIAN: "/technician/dashboard",
  ADMIN: "/admin/dashboard",
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate(REDIRECTS[user.role] || "/login");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="absolute top-4 right-4 z-10">
        <LanguageSelector />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Logo size="lg" className="mx-auto mb-3 shadow-lg shadow-purple-500/30" />
          <h1 className="font-display text-xl font-semibold text-ink-800">{t("auth.login_title")}</h1>
          <p className="mt-1 text-sm text-ink-400">{t("auth.login_subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          {error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="label">{t("auth.email")}</label>
            <input
              type="email"
              required
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="label">{t("auth.password")}</label>
            <input
              type="password"
              required
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? t("common.submitting") : t("auth.sign_in")}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-ink-500">
          {t("auth.no_account")}{" "}
          <Link to="/register" className="font-medium text-ink-800 hover:underline">
            {t("auth.register_here")}
          </Link>
        </p>
      </div>
    </div>
  );
}
