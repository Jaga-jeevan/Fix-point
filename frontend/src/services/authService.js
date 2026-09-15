import api from "./api";

export async function login(email, password) {
  const res = await api.post("/auth/login", { email, password });
  return res.data;
}

export async function register(payload) {
  const res = await api.post("/auth/register", payload);
  return res.data;
}

export async function fetchMe() {
  const res = await api.get("/auth/me");
  return res.data;
}
