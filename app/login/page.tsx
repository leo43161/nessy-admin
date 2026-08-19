"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Isotipo } from "@/components/shared/isotipo";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { login } from "@/store/slices/auth.slice";
import { EMPRESA_NOMBRE } from "@/lib/marca";
import { getToken } from "@/lib/session";

/** Adónde entra cada app después de loguearse. */
const DESPUES_DEL_LOGIN = "/operaciones";

/** Qué es esta app, debajo del nombre de la empresa. */
const BAJADA = "Panel de cobranzas";

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
    if (getToken()) router.replace(DESPUES_DEL_LOGIN);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !password) return;
    const result = await dispatch(login({ usuario, password }));
    if (login.fulfilled.match(result)) {
      router.replace(DESPUES_DEL_LOGIN);
    }
  };

  return (
    // Siempre oscuro, sin importar el tema: es la pantalla de marca. Por eso
    // usa los tokens `marca-*` de globals.css, que no se dan vuelta en `.dark`.
    <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-marca-navy-hondo via-marca-navy to-marca-navy-hondo px-5 py-6">
      {/* El isotipo ya trae el cuadrado navy y la hoja verde: sobre el fondo de
          marca el cuadrado se funde y queda la hoja, que es como lo presenta el
          propio brand sheet. El halo verde lo despega del degradé. */}
      <Isotipo className="mb-5 size-20 rounded-3xl shadow-[0_8px_32px_oklch(0.613_0.132_161.9/0.35)] ring-1 ring-white/10" />

      <h1 className="text-3xl font-bold tracking-tight text-white">
        {EMPRESA_NOMBRE}
        <span className="text-marca-verde">.</span>
      </h1>
      <p className="mb-9 text-base text-marca-tenue">{BAJADA}</p>

      <form onSubmit={handleSubmit} className="w-full max-w-85 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="usuario" className="text-white/85">
            Usuario
          </Label>
          <Input
            id="usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            placeholder="Tu usuario"
            autoComplete="username"
            autoFocus
            className="border-white/20 bg-white/5 text-white placeholder:text-marca-tenue/60"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-white/85">
            Contraseña
          </Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="border-white/20 bg-white/5 text-white placeholder:text-marca-tenue/60"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-base text-red-300"
          >
            {error}
          </p>
        )}

        {/* Verde de marca con letra navy: 4.73:1, pasa AA. Con letra blanca
            daría 3.5:1 y no llegaría. */}
        <Button
          type="submit"
          size="lg"
          disabled={cargando || !usuario.trim() || !password}
          className="w-full bg-marca-verde font-bold text-marca-navy shadow-[0_6px_20px_oklch(0.613_0.132_161.9/0.35)] hover:bg-marca-verde/90"
        >
          {cargando && <Loader2 className="animate-spin" />}
          Ingresar
        </Button>
      </form>
    </div>
  );
}
