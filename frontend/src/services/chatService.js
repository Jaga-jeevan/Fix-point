import api from "./api";

export async function listMessages(repairId) {
  const res = await api.get(`/repairs/${repairId}/messages`);
  return res.data;
}

export async function sendMessage(repairId, message) {
  const res = await api.post(`/repairs/${repairId}/messages`, { message });
  return res.data;
}
