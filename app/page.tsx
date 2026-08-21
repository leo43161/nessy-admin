import Link from "next/link";

/** La raíz no tiene pantalla propia: el panel arranca en el tablero. */
const DESTINO = "/operaciones";

/**
 * Manda al tablero con un `<meta refresh>`, no con `redirect()`.
 *
 * `redirect()` de next/navigation es del servidor, y con `output: "export"`
 * no hay servidor: esta ruta se exportaba como la cáscara de error de Next.
 * O sea que la URL más corta del panel —la que uno le pasa a alguien— caía
 * en una pantalla de error. Entrando por `/operaciones` no se notaba, y por
 * eso estuvo así desde siempre en los dos paneles.
 *
 * El meta viaja en el HTML exportado, así que redirige sin esperar a que
 * cargue el JS. El link de abajo es la red por si el navegador lo ignora:
 * queda algo para tocar en vez de una pantalla en blanco.
 *
 * ⚠️ El `basePath` se arma a mano. El panel se sirve desde una subcarpeta del
 * dominio y este meta no pasa por el router de Next, que es quien
 * normalmente lo agrega: sin esto la redirección apunta a la raíz del
 * dominio, que es otro proyecto. El `<Link>` sí lo agrega solo.
 */
export default function Home() {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <>
      <meta httpEquiv="refresh" content={`0; url=${base}${DESTINO}/`} />
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-muted-foreground">Abriendo el panel…</p>
        <Link href={DESTINO} className="font-semibold text-primary underline underline-offset-4">
          Entrar
        </Link>
      </main>
    </>
  );
}
