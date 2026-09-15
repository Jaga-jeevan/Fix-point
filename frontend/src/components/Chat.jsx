import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listMessages, sendMessage } from "../services/chatService";
import { getErrorMessage } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Chat({ repairId, enabled, recipientName = "User" }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const chatLogRef = useRef(null);

  function load() {
    listMessages(repairId)
      .then((data) => setMessages(data.messages || []))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [repairId, enabled]);

  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(e) {
    if (e) e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setError("");
    const messageContent = text.trim();
    setText("");
    try {
      await sendMessage(repairId, messageContent);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
      setText(messageContent);
    } finally {
      setSending(false);
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!enabled) {
    return (
      <div className="rounded-lg border border-ink-100 bg-white p-6 text-center">
        <p className="text-sm text-ink-400">
          {t("chat.empty")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[460px] flex-col rounded-lg border border-ink-200 bg-white shadow-sm overflow-hidden font-sans">
      {/* PROFESSIONAL COMMUNICATION PANEL HEADER */}
      <div className="flex items-center justify-between border-b border-ink-100 bg-ink-800 px-4 py-3 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-700 text-xs font-bold text-white uppercase border border-ink-600">
            {recipientName ? recipientName.charAt(0) : "U"}
          </div>
          <div>
            <h3 className="font-display text-sm font-bold leading-tight">{recipientName}</h3>
            <p className="text-[11px] text-ink-300">{t("chat.title")} · #{repairId}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-ink-700 px-2.5 py-1 rounded-full border border-ink-600">
          <span className="h-2 w-2 rounded-full bg-signal-500" />
          <span className="text-[11px] font-medium text-white">{t("status.AVAILABLE")}</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 px-3 py-1.5 text-xs text-red-700 border-b border-red-100 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-500 text-xs font-bold">✕</button>
        </div>
      )}

      {/* MESSAGES LOG CONTAINER */}
      <div ref={chatLogRef} className="flex-1 space-y-3 overflow-y-auto bg-ink-50 p-4">
        {loading && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-ink-400">{t("common.loading")}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-ink-200 text-ink-400 mb-2">
              💬
            </div>
            <p className="text-sm font-semibold text-ink-700">{t("chat.empty")}</p>
          </div>
        ) : (
          messages.map((m) => {
            const isMine = Number(m.sender_id) === Number(user?.id);
            const timeStr = m.created_at
              ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "";
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] rounded-xl px-3.5 py-2 text-xs shadow-xs relative ${
                    isMine
                      ? "bg-ink-800 text-white rounded-tr-none"
                      : "bg-white text-ink-800 border border-ink-100 rounded-tl-none"
                  }`}
                >
                  {!isMine && (
                    <p className="mb-0.5 text-[11px] font-bold text-ink-600">
                      {m.sender_name || recipientName}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed">{m.message}</p>
                  <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${isMine ? "text-ink-300" : "text-ink-400"}`}>
                    <span>{timeStr}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MESSAGE INPUT BAR */}
      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-ink-100 bg-white p-3">
        <input
          className="flex-1 rounded-md border border-ink-200 bg-white px-3.5 py-2 text-xs text-ink-800 placeholder-ink-400 focus:border-ink-400 focus:outline-none transition-all"
          placeholder={t("chat.type_message")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className={`btn-primary text-xs px-4 py-2 ${
            sending || !text.trim() ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {sending ? t("common.submitting") : t("chat.send")}
        </button>
      </form>
    </div>
  );
}
