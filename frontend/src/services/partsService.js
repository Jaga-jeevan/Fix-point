import api from "./api";

export async function listPartsInventory() {
  const res = await api.get("/parts");
  return res.data;
}

export async function listPartsUsed(repairId) {
  const res = await api.get(`/repairs/${repairId}/parts`);
  return res.data;
}

export async function addPartUsed(repairId, partData, quantityLegacy) {
  const payload = typeof partData === "object" ? partData : { part_id: partData, quantity: quantityLegacy };
  const res = await api.post(`/repairs/${repairId}/parts`, payload);
  return res.data;
}

export async function updatePartUsed(repairId, partUsedId, partData) {
  const res = await api.put(`/repairs/${repairId}/parts/${partUsedId}`, partData);
  return res.data;
}

export async function removePartUsed(repairId, partUsedId) {
  const res = await api.delete(`/repairs/${repairId}/parts/${partUsedId}`);
  return res.data;
}

