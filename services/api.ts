import axios from "axios";
import { clearSession, getToken } from "@/lib/session";

/**
 * Mientras la API esté en desarrollo los servicios usan el backend mock.
 * Cuando esté lista: definir NEXT_PUBLIC_API_URL y NEXT_PUBLIC_USE_MOCK=false.
 */
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// La API envuelve TODO en { status, message, data }. Se desenvuelve acá una
// sola vez para que los servicios reciban el payload y nada más.
// Ojo: `data` no suele ser el array pelado sino un objeto con la colección
// adentro ({ total, clientes: [...] }); eso lo destraba cada servicio.
api.interceptors.response.use(
  (response) => {
    const cuerpo = response.data;
    if (cuerpo && typeof cuerpo === "object" && "status" in cuerpo && "data" in cuerpo) {
      response.data = cuerpo.data;
    }
    return response;
  },
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearSession();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);
