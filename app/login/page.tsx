"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { login } from "@/store/slices/auth.slice";
import { getToken } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { status, error } = useAppSelector((s) => s.auth);
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const cargando = status === "loading";

  // Con sesión abierta, /login no tiene nada que mostrar. Antes lo cortaba
  // proxy.ts leyendo la cookie; con output:"export" no hay servidor que la
  // lea, así que el rebote se hace acá.
  //
  // Es optimista igual que el proxy: mira que el token esté, no que sirva.
  // Si está vencido, el layout lo valida, hace clearSession() y devuelve acá
  // — un rebote y se queda, porque ya no hay token que leer.
  useEffect(() => {
    if (getToken()) router.replace("/operaciones");
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !password) return;
    const result = await dispatch(login({ usuario, password }));
    if (login.fulfilled.match(result)) {
      router.replace("/operaciones");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#0B1B34] via-[#0F2A52] to-[#0F4DB5] px-5 py-6">
      <div className="mb-4 flex size-18 items-center justify-center rounded-3xl bg-gradient-to-br from-[#1A6FE8] to-[#38BDF8] shadow-[0_8px_32px_rgba(26,111,232,0.45)]">
        <Activity className="size-9 text-white" strokeWidth={2.5} />
      </div>
      <h1 className="text-2xl font-bold text-white">
        Nessy<span className="text-[#38BDF8]">Admin</span>
      </h1>
      <p className="mb-9 text-sm text-blue-200/70">Panel de cobranzas</p>

      <form onSubmit={handleSubmit} className="w-full max-w-85 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="usuario" className="text-blue-100">
            Usuario
          </Label>
          <Input
            id="usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            placeholder="Tu usuario"
            autoComplete="username"
            autoFocus
            className="h-11 border-white/15 bg-white/5 text-white placeholder:text-blue-200/40"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-blue-100">
            Contraseña
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="h-11 border-white/15 bg-white/5 text-white placeholder:text-blue-200/40"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={cargando || !usuario.trim() || !password}
          className="h-11 w-full bg-gradient-to-br from-[#1A6FE8] to-[#0F4DB5] text-base font-bold text-white shadow-[0_6px_20px_rgba(26,111,232,0.45)] hover:opacity-90"
        >
          {cargando && <Loader2 className="animate-spin" />}
          Ingresar
        </Button>
      </form>

    </div>
  );
}
