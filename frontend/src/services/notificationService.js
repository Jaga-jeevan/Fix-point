import api from "./api";

export async function listNotifications() {
  const res = await api.get("/notifications");
  return res.data;
}

export async function markRead(id) {
  const res = await api.patch(`/notifications/${id}/read`);
  return res.data;
}

export async function markAllRead() {
  const res = await api.patch("/notifications/read-all");
  return res.data;
}
