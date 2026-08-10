import axios from "axios";
import { clearSession, getToken } from "@/lib/session";

/**
 * Cliente HTTP contra la API de Nessy. Es el único backend: no hay mock.
 *
 * NEXT_PUBLIC_API_URL sale de .env.local en desarrollo y del workflow en el
 * deploy. Si falta, se rompe acá y no en la primera request, que es más fácil
 * de diagnosticar que un 404 suelto.
 */
if (!process.env.NEXT_PUBLIC_API_URL) {
  throw new Error("Falta NEXT_PUBLIC_API_URL: la app no sabe contra qué API hablar.");
}

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
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

    // La API explica el problema; axios solo sabe el número. Se pisa el mensaje
    // acá, una vez, para que los slices sigan usando `err.message` y muestren
    // "Faltan campos obligatorios: DNI" en vez de "Request failed with status
    // code 400", que no dice qué campo ni manda a mirar el lugar correcto.
    if (axios.isAxiosError(error)) {
      const delApi = (error.response?.data as { message?: string } | undefined)?.message;
      if (delApi) error.message = delApi;
    }

    return Promise.reject(error);
  },
);
