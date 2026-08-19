import { EMPRESA_LOGO, EMPRESA_NOMBRE, MARCA_COLORES, MARCA_ISOTIPO } from "@/lib/marca";

/**
 * El isotipo de la marca para la web.
 *
 * Dibuja `MARCA_ISOTIPO` como SVG inline. Si en `lib/marca.ts` hay un
 * `EMPRESA_LOGO` cargado, gana ese: el data URI es la salida de escape para
 * una marca que no se pueda hacer con vectores simples.
 *
 * El gemelo para el PDF está en `lib/pdf/isotipo-pdf.tsx` — @react-pdf no
 * renderiza SVG del DOM, tiene sus propias primitivas. Los dos leen la misma
 * geometría de `lib/marca.ts`.
 */
export function Isotipo({ className }: { className?: string }) {
  if (EMPRESA_LOGO !== "") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={EMPRESA_LOGO} alt={EMPRESA_NOMBRE} className={className} />;
  }

  const { hoja } = MARCA_ISOTIPO;

  return (
    <svg viewBox={MARCA_ISOTIPO.viewBox} className={className} role="img" aria-label={EMPRESA_NOMBRE}>
      <rect width="240" height="240" rx={MARCA_ISOTIPO.radio} fill={MARCA_COLORES.primario} />
      {/* La hoja va en un lienzo propio: su path tiene coordenadas que no son
          las del cuadrado, y el viewBox anidado hace el encaje solo. */}
      <svg
        x={hoja.x}
        y={hoja.y}
        width={hoja.ancho}
        height={hoja.alto}
        viewBox={MARCA_ISOTIPO.hojaViewBox}
      >
        <path d={MARCA_ISOTIPO.path} fill={MARCA_COLORES.acento} />
      </svg>
    </svg>
  );
}
