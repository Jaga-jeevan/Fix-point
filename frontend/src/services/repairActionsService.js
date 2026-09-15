import api from "./api";

export async function listActions(repairId) {
  const res = await api.get(`/repairs/${repairId}/actions`);
  return res.data;
}

export async function addAction(repairId, description) {
  const res = await api.post(`/repairs/${repairId}/actions`, { description });
  return res.data;
}
