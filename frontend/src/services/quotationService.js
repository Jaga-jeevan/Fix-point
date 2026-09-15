import api from "./api";

export async function getQuotation(repairId) {
  const res = await api.get(`/repairs/${repairId}/quotation`);
  return res.data;
}

export async function saveQuotation(repairId, payload) {
  const res = await api.post(`/repairs/${repairId}/quotation`, payload);
  return res.data;
}

export async function sendQuotation(repairId) {
  const res = await api.post(`/repairs/${repairId}/quotation/send`);
  return res.data;
}

export async function approveQuotation(repairId) {
  const res = await api.post(`/repairs/${repairId}/quotation/approve`);
  return res.data;
}

export async function rejectQuotation(repairId) {
  const res = await api.post(`/repairs/${repairId}/quotation/reject`);
  return res.data;
}

export async function requestQuotationRevision(repairId, payload) {
  const res = await api.post(`/repairs/${repairId}/quotation/request-revision`, payload);
  return res.data;
}

export async function submitPayment(repairId, payload) {
  const body = typeof payload === "string" ? { utr: payload, payment_method: "UPI" } : payload;
  const res = await api.post(`/repairs/${repairId}/quotation/pay`, body);
  return res.data;
}

export async function verifyPayment(repairId) {
  const res = await api.post(`/repairs/${repairId}/quotation/verify-payment`);
  return res.data;
}
