import api from "./api";

export async function getDashboard() {
  const res = await api.get("/admin/dashboard");
  return res.data;
}

export async function listRepairs(status) {
  const res = await api.get("/admin/repairs", { params: status ? { status } : {} });
  return res.data;
}

export async function getRepair(id) {
  const res = await api.get(`/admin/repairs/${id}`);
  return res.data;
}

export async function approveRepair(id) {
  const res = await api.post(`/admin/repairs/${id}/approve`);
  return res.data;
}

export async function rejectRepair(id, remarks) {
  const res = await api.post(`/admin/repairs/${id}/reject`, { remarks });
  return res.data;
}

export async function listTechnicians(availableOnly) {
  const res = await api.get("/admin/technicians", {
    params: availableOnly ? { available: "true" } : {},
  });
  return res.data;
}

export async function listCustomers(query) {
  const res = await api.get("/admin/customers", {
    params: query ? { q: query } : {},
  });
  return res.data;
}

export async function getCustomer(id) {
  const res = await api.get(`/admin/customers/${id}`);
  return res.data;
}

