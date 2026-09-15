import api from "./api";

export async function createRepair(formData) {
  const res = await api.post("/customer/repairs", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function listMyRepairs() {
  const res = await api.get("/customer/repairs");
  return res.data;
}

export async function getMyRepair(id) {
  const res = await api.get(`/customer/repairs/${id}`);
  return res.data;
}

export async function regenerateOTP(id) {
  const res = await api.post(`/customer/repairs/${id}/regenerate-otp`);
  return res.data;
}

export async function deleteMyRepair(id) {
  const res = await api.delete(`/customer/repairs/${id}`);
  return res.data;
}

