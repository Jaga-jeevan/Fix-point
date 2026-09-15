import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../../components/Layout";
import { useAuth } from "../../context/AuthContext";
import { createRepair, listMyRepairs } from "../../services/customerService";
import { getErrorMessage } from "../../services/api";

const initialForm = {
  device_type: "",
  brand: "",
  model: "",
  problem_description: "",
  preferred_date: "",
  preferred_time: "",
  address: "",
};

const DEVICE_OPTIONS = [
  {
    id: "Laptop",
    key: "device_types.Laptop",
    label: "Laptop",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "Desktop",
    key: "device_types.Desktop",
    label: "Desktop",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "Mobile",
    key: "device_types.Mobile",
    label: "Mobile",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "Tablet",
    key: "device_types.Tablet",
    label: "Tablet",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "TV",
    key: "device_types.TV",
    label: "TV",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4L12 9L17 4M3 9H21V19A1 1 0 0120 20H4A1 1 0 013 19V9Z" />
      </svg>
    ),
  },
  {
    id: "Other",
    key: "device_types.Other",
    label: "Other",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
];

function parseDateString(str) {
  if (!str) return "";
  const clean = str.toLowerCase().trim();
  const today = new Date();

  // 1. Relative keywords
  if (clean === "today") {
    return today.toISOString().split("T")[0];
  }
  if (clean === "tomorrow") {
    const tmr = new Date(today);
    tmr.setDate(tmr.getDate() + 1);
    return tmr.toISOString().split("T")[0];
  }
  if (clean.includes("day after tomorrow")) {
    const dat = new Date(today);
    dat.setDate(dat.getDate() + 2);
    return dat.toISOString().split("T")[0];
  }

  // 2. Standard ISO format: YYYY-MM-DD
  const isoMatch = clean.match(/\b(20[2-9][0-9])[-/.]([0-1]?[0-9])[-/.]([0-3]?[0-9])\b/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, "0");
    const d = isoMatch[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // 3. Numeric formats like "11 10 26", "11/10/2026", "11-10-26", "11 10 2026"
  const numMatch = clean.match(/\b([0-3]?[0-9])[\s/.\-]([0-1]?[0-9])[\s/.\-](20[2-9][0-9]|[2-9][0-9])\b/);
  if (numMatch) {
    let day = parseInt(numMatch[1], 10);
    let month = parseInt(numMatch[2], 10);
    let year = parseInt(numMatch[3], 10);

    if (year < 100) year += 2000;

    // Handle DD/MM or MM/DD logic safely
    if (month > 12 && day <= 12) {
      const temp = day;
      day = month;
      month = temp;
    }

    const yStr = `${year}`;
    const mStr = `${month}`.padStart(2, "0");
    const dStr = `${day}`.padStart(2, "0");
    return `${yStr}-${mStr}-${dStr}`;
  }

  // 4. Try JS Date constructor with cleaned separators
  const normalized = clean.replace(/[\s\-_]+/g, "/");
  const jsDate = new Date(normalized);
  if (!isNaN(jsDate.getTime())) {
    return jsDate.toISOString().split("T")[0];
  }

  // 5. Try JS Date constructor directly
  const directDate = new Date(clean);
  if (!isNaN(directDate.getTime())) {
    return directDate.toISOString().split("T")[0];
  }

  return "";
}

function parseTimeString(str) {
  if (!str) return "";
  const clean = str.toLowerCase().trim();

  const match = clean.match(/^([0-9]{1,2})(?:[\s:]?([0-9]{2}))?\s*(am|pm)?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2] ? match[2] : "00";
    const ampm = match[3] ? match[3].toLowerCase() : null;

    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;

    const hStr = hours < 10 ? `0${hours}` : `${hours}`;
    return `${hStr}:${minutes}`;
  }

  return str;
}

export default function CreateRepair() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [customDeviceType, setCustomDeviceType] = useState("");
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState("");

  const todayDate = new Date().toISOString().split("T")[0];

  function applyVoiceFields(fields) {
    if (!fields) return;
    let noticeItems = [];

    setForm((prev) => {
      const next = { ...prev };
      if (fields.device_type) {
        const dt = fields.device_type.toLowerCase();
        if (dt.includes("laptop")) next.device_type = "Laptop";
        else if (dt.includes("desktop") || dt.includes("computer")) next.device_type = "Desktop";
        else if (dt.includes("tablet") || dt.includes("ipad")) next.device_type = "Tablet";
        else if (dt.includes("tv") || dt.includes("television")) next.device_type = "TV";
        else if (dt.includes("other")) next.device_type = "Other";
        else next.device_type = "Mobile";
        noticeItems.push(`Device: ${next.device_type}`);
      }
      if (fields.brand) {
        next.brand = fields.brand;
        noticeItems.push(`Brand: ${fields.brand}`);
      }
      if (fields.model) {
        next.model = fields.model;
        noticeItems.push(`Model: ${fields.model}`);
      }
      if (fields.preferred_date) {
        next.preferred_date = parseDateString(fields.preferred_date);
        noticeItems.push(`Date: ${next.preferred_date}`);
      }
      if (fields.preferred_time) {
        next.preferred_time = parseTimeString(fields.preferred_time);
        noticeItems.push(`Time: ${next.preferred_time}`);
      }
      if (fields.problem_description || fields.issue) {
        next.problem_description = fields.problem_description || fields.issue;
        noticeItems.push(`Problem: ${next.problem_description}`);
      }
      if (fields.address) {
        next.address = fields.address;
        noticeItems.push(`Address: ${fields.address}`);
      } else if (!next.address && user?.address) {
        next.address = user.address;
      }
      return next;
    });

    if (noticeItems.length > 0) {
      setVoiceNotice(`Details Entered via Voice: ${noticeItems.join(" | ")}`);
      setTimeout(() => setVoiceNotice(""), 8000);
    }
  }

  const [activeRepair, setActiveRepair] = useState(null);

  useEffect(() => {
    listMyRepairs()
      .then((data) => {
        const list = data.repairs || [];
        const active = list.find(
          (r) => !["COMPLETED", "REJECTED", "CANCELLED"].includes(r.status)
        );
        if (active) {
          setActiveRepair(active);
        }
      })
      .catch(() => {});

    const pending = sessionStorage.getItem("pending_voice_form_fields");
    if (pending) {
      try {
        const parsed = JSON.parse(pending);
        sessionStorage.removeItem("pending_voice_form_fields");
        applyVoiceFields(parsed);
      } catch (e) {}
    }

    const handleVoiceEvent = (e) => {
      if (e.detail) {
        applyVoiceFields(e.detail);
      }
    };

    const handleClearEvent = () => {
      setForm({
        device_type: "",
        brand: "",
        model: "",
        problem_description: "",
        preferred_date: "",
        preferred_time: "",
        address: user?.address || "",
      });
      setCustomDeviceType("");
      setPhoto(null);
      setPreview(null);
      setError("");
      setVoiceNotice("All fields cleared via Voice command");
      setTimeout(() => setVoiceNotice(""), 5000);
    };

    const handleSubmitEvent = () => {
      const submitBtn = document.getElementById("create-repair-submit-btn");
      if (submitBtn) {
        submitBtn.click();
      }
    };

    window.addEventListener("voice-fill-repair-form", handleVoiceEvent);
    window.addEventListener("voice-clear-repair-form", handleClearEvent);
    window.addEventListener("voice-submit-repair-form", handleSubmitEvent);

    return () => {
      window.removeEventListener("voice-fill-repair-form", handleVoiceEvent);
      window.removeEventListener("voice-clear-repair-form", handleClearEvent);
      window.removeEventListener("voice-submit-repair-form", handleSubmitEvent);
    };
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleFileSelect(file) {
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    handleFileSelect(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    handleFileSelect(file);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function removePhoto() {
    setPhoto(null);
    setPreview(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setError("");

    const finalDeviceType = form.device_type === "Other" ? customDeviceType.trim() : form.device_type;

    if (!form.device_type) {
      setError(t("device_types.select_device_type") || "Please select a device type.");
      return;
    }

    if (form.device_type === "Other" && !customDeviceType.trim()) {
      setError(t("device_types.enter_device_type") || "Please specify your device type.");
      return;
    }

    if (!form.brand.trim() || !form.model.trim()) {
      setError(t("customer.enter_brand_model") || "Please enter brand and model details.");
      return;
    }

    if (!form.preferred_date.trim()) {
      setError(t("customer.select_preferred_date") || "Please select a preferred date.");
      return;
    }

    if (form.preferred_date < todayDate) {
      setError(t("customer.date_cannot_be_past") || "Preferred visit date cannot be in the past.");
      return;
    }

    if (!form.preferred_time.trim()) {
      setError(t("customer.select_preferred_time") || "Please select a preferred time.");
      return;
    }

    if (!form.problem_description.trim() || !form.address.trim()) {
      setError(t("customer.fill_all_fields") || "Please fill in all required fields.");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      formData.append(key, key === "device_type" ? finalDeviceType : value);
    });
    if (photo) formData.append("photo", photo);

    try {
      const data = await createRepair(formData);
      navigate(`/customer/repairs/${data.repair.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        {/* HEADER TITLE */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{t("customer.new_repair_title")}</h1>
          <p className="text-xs text-slate-400 mt-1 font-normal">
            {t("customer.new_repair_subtitle")}
          </p>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[11px] font-semibold text-blue-700">
            <svg className="w-3.5 h-3.5 text-blue-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <span>Voice Controls Active — Speak to select Device, Brand, Model, Date, Time, or Submit</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {voiceNotice && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3.5 text-xs text-blue-800 font-semibold shadow-xs flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-ping" />
                <span>{voiceNotice}</span>
              </div>
              <button type="button" onClick={() => setVoiceNotice("")} className="font-bold text-blue-900">
                ×
              </button>
            </div>
          )}

          {activeRepair && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700 mt-0.5">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-amber-900">Active Repair Request In Progress (#{activeRepair.id})</h3>
                  <p className="text-xs text-amber-700 mt-0.5 font-medium">
                    You already have an active repair request for <strong>{activeRepair.device?.brand} {activeRepair.device?.model}</strong> (Status: <span className="font-semibold">{activeRepair.status}</span>). Only one active repair request is permitted from acceptance to completion.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/customer/repairs/${activeRepair.id}`)}
                className="btn-primary bg-amber-600 hover:bg-amber-700 text-white shrink-0 text-xs px-4 py-2"
              >
                View Repair #{activeRepair.id} →
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-700 font-medium shadow-xs">
              {error}
            </div>
          )}

          {/* SECTION 1 - DEVICE TYPE */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xs space-y-5">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {t("customer.section_device_type")}
            </h2>

            {/* DEVICE TYPE CARDS */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {DEVICE_OPTIONS.map((opt) => {
                const isSelected = form.device_type === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => update("device_type", opt.id)}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all cursor-pointer text-center space-y-2 h-24 ${
                      isSelected
                        ? "border-2 border-blue-600 bg-white text-blue-600 font-semibold shadow-xs"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className={isSelected ? "text-blue-600" : "text-slate-400"}>
                      {opt.icon}
                    </div>
                    <span className="text-xs font-medium">{t(opt.key) || opt.label}</span>
                  </button>
                );
              })}
            </div>

            {form.device_type === "Other" && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t("device_types.specify_device_type").toUpperCase()}
                </label>
                <input
                  type="text"
                  required
                  value={customDeviceType}
                  onChange={(e) => setCustomDeviceType(e.target.value)}
                  placeholder={t("customer.specify_device_type_placeholder")}
                  className="input"
                />
              </div>
            )}

            {/* BRAND & MODEL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label htmlFor="brand" className="block text-xs font-semibold text-slate-700 mb-1">
                  {t("customer.brand").toUpperCase()}
                </label>
                <input
                  type="text"
                  id="brand"
                  required
                  value={form.brand}
                  onChange={(e) => update("brand", e.target.value)}
                  placeholder={t("customer.brand_placeholder")}
                  className="input"
                />
              </div>

              <div>
                <label htmlFor="model" className="block text-xs font-semibold text-slate-700 mb-1">
                  {t("customer.model").toUpperCase()}
                </label>
                <input
                  type="text"
                  id="model"
                  required
                  value={form.model}
                  onChange={(e) => update("model", e.target.value)}
                  placeholder={t("customer.model_placeholder")}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2 - PREFERRED DATE & PREFERRED TIME */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xs space-y-4">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {t("customer.section_date_time")}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="preferred_date" className="block text-xs font-semibold text-slate-700 mb-1">
                  {t("customer.preferred_date").toUpperCase()}
                </label>
                <input
                  type="date"
                  id="preferred_date"
                  required
                  min={todayDate}
                  value={form.preferred_date}
                  onChange={(e) => update("preferred_date", e.target.value)}
                  className="input cursor-pointer"
                />
              </div>

              <div>
                <label htmlFor="preferred_time" className="block text-xs font-semibold text-slate-700 mb-1">
                  {t("customer.preferred_time").toUpperCase()}
                </label>
                <input
                  type="time"
                  id="preferred_time"
                  required
                  value={form.preferred_time}
                  onChange={(e) => update("preferred_time", e.target.value)}
                  className="input cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3 - ISSUE DESCRIPTION & LOCATION */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xs space-y-5">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {t("customer.section_issue_location")}
            </h2>

            <div>
              <label htmlFor="problem_description" className="block text-xs font-semibold text-slate-700 mb-1">
                {t("customer.problem_description").toUpperCase()}
              </label>
              <textarea
                id="problem_description"
                required
                rows={4}
                value={form.problem_description}
                onChange={(e) => update("problem_description", e.target.value)}
                placeholder={t("customer.problem_placeholder")}
                className="input resize-none"
              />
            </div>

            <div>
              <label htmlFor="address" className="block text-xs font-semibold text-slate-700 mb-1">
                {t("customer.address").toUpperCase()}
              </label>
              <input
                type="text"
                id="address"
                required
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder={t("customer.address_placeholder")}
                className="input"
              />
            </div>

            {/* DEVICE PHOTO (OPTIONAL) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t("customer.device_photo").toUpperCase()}
              </label>

              {preview ? (
                <div className="relative rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-4">
                  <img src={preview} alt="Preview" className="h-20 w-20 rounded-xl object-cover border border-slate-200" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{photo?.name || t("customer.device_photo_name")}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{t("customer.ready_for_upload")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="btn-outline text-rose-600 border-rose-200 hover:bg-rose-50 text-xs px-3 py-1.5"
                  >
                    {t("customer.remove_photo")}
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                    isDragOver
                      ? "border-blue-500 bg-blue-50/40"
                      : "border-slate-200 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/20"
                  }`}
                >
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    onChange={handlePhotoChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-xs text-slate-600 font-medium">
                      <span className="text-blue-600 font-semibold">{t("customer.upload_photo")}</span> {t("customer.or_drag_drop")}
                    </p>
                    <p className="text-[11px] text-slate-400">{t("customer.photo_formats")}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <button
            id="create-repair-submit-btn"
            type="submit"
            disabled={loading || !!activeRepair}
            className={`btn-primary w-full py-3.5 text-xs font-bold uppercase tracking-wider shadow-md ${
              activeRepair ? "opacity-50 cursor-not-allowed bg-slate-400 border-slate-400 shadow-none" : "shadow-blue-600/15"
            }`}
          >
            {loading
              ? t("customer.submitting_request")
              : activeRepair
              ? `Active Repair In Progress (#${activeRepair.id})`
              : t("customer.submit_request")}
          </button>
        </form>
      </div>
    </Layout>
  );
}
