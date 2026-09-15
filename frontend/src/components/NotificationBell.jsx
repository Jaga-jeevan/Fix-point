import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listNotifications, markRead, markAllRead } from "../services/notificationService";

const HOME_BY_ROLE = {
  CUSTOMER: (repairId) => `/customer/repairs/${repairId}`,
  TECHNICIAN: (repairId) => `/technician/jobs/${repairId}`,
};

export default function NotificationBell({ role }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const ref = useRef(null);
  const { t } = useTranslation();

  function load() {
    listNotifications()
      .then((data) => {
        setNotifications(data.notifications);
        setUnreadCount(data.unread_count);
      })
      .catch(() => {});
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleOpenNotification(n) {
    if (!n.is_read) {
      try {
        await markRead(n.id);
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
    load();
    if (n.repair_id && HOME_BY_ROLE[role]) {
      navigate(HOME_BY_ROLE[role](n.repair_id));
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllRead();
      load();
    } catch {
      /* ignore */
    }
  }

  function getNotificationTitle(n) {
    if (n.type === "STATUS_CHANGE" || n.title === "Repair status updated") return t("notifications.status_change");
    if (n.type === "NEW_REQUEST" || n.title === "New repair request available") return t("notifications.new_request");
    if (n.title === "Quotation ready") return t("notifications.quotation_ready");
    if (n.title === "Quotation approved") return t("notifications.quotation_approved");
    if (n.title === "Quotation rejected") return t("notifications.quotation_rejected");
    if (n.title === "Payment Submitted") return t("notifications.payment_submitted");
    if (n.title === "Payment Verified") return t("notifications.payment_verified");
    if (n.title === "Technician assigned") return t("notifications.technician_assigned");
    if (n.title === "New message") return t("notifications.new_message");
    if (n.title === "Repair action updated") return t("notifications.repair_action_updated");
    if (n.title === "Parts added") return t("notifications.parts_added");
    return n.title;
  }

  function getNotificationMessage(n) {
    if (n.type === "STATUS_CHANGE" && n.repair_id) {
      const match = n.message.match(/is now:\s*(.*?)\.?$/i);
      const rawStatus = match ? match[1].replace(/[\.\s]/g, "").toUpperCase() : "";
      const statusLabel = rawStatus && t(`status.${rawStatus}`) !== `status.${rawStatus}` ? t(`status.${rawStatus}`) : match ? match[1] : "";
      return t("notifications.status_change_msg", { id: n.repair_id, status: statusLabel });
    }

    if (n.type === "NEW_REQUEST" && n.repair_id) {
      const match = n.message.match(/\((.*?)\)/);
      const devType = match ? match[1] : "device";
      const devLabel = t(`device_types.${devType}`) !== `device_types.${devType}` ? t(`device_types.${devType}`) : devType;
      return t("notifications.new_request_msg", { id: n.repair_id, type: devLabel });
    }

    // Quotation ready: "A quotation for repair #5 is ready for your review (total: 1200.00)."
    if (n.title === "Quotation ready" || n.message.includes("is ready for your review")) {
      const idMatch = n.message.match(/repair #(\d+)/i);
      const totalMatch = n.message.match(/total:\s*([\d\.]+)/i);
      const id = idMatch ? idMatch[1] : n.repair_id || "";
      const total = totalMatch ? totalMatch[1] : "";
      return t("notifications.quotation_ready_msg", { id, total });
    }

    // Quotation approved: "The customer approved your quotation for repair #5."
    if (n.title === "Quotation approved" || n.message.includes("approved your quotation")) {
      const idMatch = n.message.match(/repair #(\d+)/i);
      const id = idMatch ? idMatch[1] : n.repair_id || "";
      return t("notifications.quotation_approved_msg", { id });
    }

    // Quotation rejected: "The customer rejected your quotation for repair #5."
    if (n.title === "Quotation rejected" || n.message.includes("rejected your quotation")) {
      const idMatch = n.message.match(/repair #(\d+)/i);
      const id = idMatch ? idMatch[1] : n.repair_id || "";
      return t("notifications.quotation_rejected_msg", { id });
    }

    // Payment Submitted (UTR): "Customer submitted payment UTR 004826097785 for repair #5. Pending verification."
    if (n.title === "Payment Submitted" && (n.message.includes("UTR") || n.message.includes("UPI"))) {
      const idMatch = n.message.match(/repair #(\d+)/i);
      const utrMatch = n.message.match(/UTR\s+([A-Za-z0-9_-]+)/i);
      const id = idMatch ? idMatch[1] : n.repair_id || "";
      const utr = utrMatch ? utrMatch[1] : "";
      return t("notifications.payment_submitted_utr_msg", { id, utr });
    }

    // Payment Submitted (Cash): "Customer selected cash payment for repair #5. Pending technician collection & verification."
    if (n.title === "Payment Submitted" && n.message.includes("cash payment")) {
      const idMatch = n.message.match(/repair #(\d+)/i);
      const id = idMatch ? idMatch[1] : n.repair_id || "";
      return t("notifications.payment_submitted_cash_msg", { id });
    }

    // Payment Verified (UTR): "Your payment for repair #5 (UTR: 004826097785) has been verified and marked as PAID."
    if (n.title === "Payment Verified" && n.message.includes("UTR")) {
      const idMatch = n.message.match(/repair #(\d+)/i);
      const utrMatch = n.message.match(/UTR:\s*([A-Za-z0-9_-]+)/i);
      const id = idMatch ? idMatch[1] : n.repair_id || "";
      const utr = utrMatch ? utrMatch[1] : "";
      return t("notifications.payment_verified_utr_msg", { id, utr });
    }

    // Payment Verified (Cash): "Your cash payment for repair #5 has been collected and verified as PAID."
    if (n.title === "Payment Verified" && n.message.includes("cash payment")) {
      const idMatch = n.message.match(/repair #(\d+)/i);
      const id = idMatch ? idMatch[1] : n.repair_id || "";
      return t("notifications.payment_verified_cash_msg", { id });
    }

    // Technician assigned: "John Doe accepted your repair request #5."
    if (n.title === "Technician assigned" || n.message.includes("accepted your repair request")) {
      const match = n.message.match(/^(.*?)\s+accepted your repair request #(\d+)/i);
      if (match) {
        return t("notifications.technician_assigned_msg", { name: match[1], id: match[2] });
      }
    }

    // New message: "New message on repair #5: \"...\""
    if (n.title === "New message" || n.message.includes("New message on repair #")) {
      const match = n.message.match(/New message on repair #(\d+):\s*"(.*)"/i);
      if (match) {
        return t("notifications.new_message_msg", { id: match[1], text: match[2] });
      }
    }

    // Repair action updated: "Repair #5: Replaced screen"
    if (n.title === "Repair action updated" || n.message.startsWith("Repair #")) {
      const match = n.message.match(/^Repair #(\d+):\s*(.*)$/i);
      if (match) {
        return t("notifications.repair_action_msg", { id: match[1], description: match[2] });
      }
    }

    // Parts added: "2 x RAM added to repair #5."
    if (n.title === "Parts added" || n.message.includes("added to repair #")) {
      const match = n.message.match(/^(\d+)\s*x\s*(.*?)\s+added to repair #(\d+)/i);
      if (match) {
        return t("notifications.parts_msg", { quantity: match[1], part: match[2], id: match[3] });
      }
    }

    return n.message;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="notif-bell-btn"
        aria-label={t("notifications.title")}
      >
        <svg viewBox="0 0 448 512" className="bell-svg">
          <path d="M224 0c-17.7 0-32 14.3-32 32V49.9C119.5 61.4 64 124.2 64 200v33.4c0 45.4-15.5 89.5-43.8 124.9L5.3 377c-5.8 7.2-6.9 17.1-2.9 25.4S14.8 416 24 416H424c9.2 0 17.6-5.3 21.6-13.6s2.9-18.2-2.9-25.4l-14.9-18.6C399.5 322.9 384 278.8 384 233.4V200c0-75.8-55.5-138.6-128-150.1V32c0-17.7-14.3-32-32-32zm0 96h8c57.4 0 104 46.6 104 104v33.4c0 47.9 13.9 94.6 39.7 134.6H72.3C98.1 328 112 281.3 112 233.4V200c0-57.4 46.6-104 104-104h8zm64 352H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7s18.7-28.3 18.7-45.3z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-xs">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-md border border-ink-100 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2">
            <p className="text-sm font-medium text-ink-700">{t("notifications.title")}</p>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-ink-500 hover:underline">
                {t("notifications.mark_all_read")}
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-ink-400">{t("notifications.no_notifications")}</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleOpenNotification(n)}
                  className={`block w-full border-b border-ink-50 px-3 py-2 text-left text-sm hover:bg-ink-50 ${
                    n.is_read ? "text-ink-500" : "text-ink-800"
                  }`}
                >
                  <p className={`font-medium ${n.is_read ? "" : "text-ink-900"}`}>{getNotificationTitle(n)}</p>
                  <p className="text-xs text-ink-500">{getNotificationMessage(n)}</p>
                  <p className="mt-0.5 text-[11px] text-ink-300">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
