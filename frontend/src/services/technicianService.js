import api from "./api";

export async function getDashboard() {
  const res = await api.get("/technician/dashboard");
  return res.data;
}

export async function listJobs() {
  const res = await api.get("/technician/jobs");
  return res.data;
}

export async function getJob(id) {
  const res = await api.get(`/technician/jobs/${id}`);
  return res.data;
}

export async function verifyOTP(id, otp) {
  const res = await api.post(`/technician/jobs/${id}/verify-otp`, { otp });
  return res.data;
}

export async function acceptJob(id) {
  const res = await api.post(`/technician/jobs/${id}/accept`);
  return res.data;
}

export async function startTravel(id) {
  const res = await api.post(`/technician/jobs/${id}/start-travel`);
  return res.data;
}

export async function receiveDevice(id, formData) {
  const res = await api.post(`/technician/jobs/${id}/receive-device`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function startRepair(id) {
  const res = await api.post(`/technician/jobs/${id}/start-repair`);
  return res.data;
}

export async function completeJob(id) {
  const res = await api.post(`/technician/jobs/${id}/complete`);
  return res.data;
}

export async function listAvailableRequests() {
  const res = await api.get("/technician/available-requests");
  return res.data;
}

export async function acceptAvailableRequest(id) {
  const res = await api.post(`/technician/available-requests/${id}/accept`);
  return res.data;
}

export async function setAvailability(status) {
  const res = await api.patch("/technician/availability", { availability_status: status });
  return res.data;
}
