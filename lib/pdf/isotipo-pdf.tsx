import { Image, Path, Svg, View } from "@react-pdf/renderer";
import { EMPRESA_LOGO, MARCA_COLORES, MARCA_ISOTIPO } from "@/lib/marca";

/**
 * El isotipo dentro del PDF.
 *
 * @react-pdf tiene sus propias primitivas de SVG (no renderiza markup del
 * DOM), así que este es el gemelo de `components/shared/isotipo.tsx`. Los dos
 * leen la misma geometría de `lib/marca.ts`: si cambia la marca, cambia en los
 * dos lados solo.
 *
 * Dibujarlo en vez de incrustar el PNG mantiene el PDF liviano —el logo de
 * marca son 170 KB en base64 para algo que se imprime a 30 pt— y sale nítido
 * en papel, que es donde termina este documento.
 *
 * El cuadrado es un `View` con `borderRadius` en vez de un `Rect`: @react-pdf
 * ubica cada nodo SVG con su propio origen, así que componer el cuadrado y la
 * hoja dentro de un mismo lienzo obligaba a un `transform` que no da igual que
 * en el navegador. Con un View de fondo y la hoja en su propio `Svg`, el
 * encaje lo resuelve el layout y los dos renderers coinciden.
 */
export function IsotipoPdf({ tam = 30 }: { tam?: number }) {
  if (EMPRESA_LOGO !== "") {
    return <Image src={EMPRESA_LOGO} style={{ width: tam, height: tam, objectFit: "contain" }} />;
  }

  const { hoja, viewBox } = MARCA_ISOTIPO;
  // El viewBox del isotipo es cuadrado, así que alcanza con el lado para pasar
  // los márgenes de la hoja de unidades de diseño a puntos.
  const lado = Number(viewBox.split(" ")[2]);

  return (
    <View
      style={{
        width: tam,
        height: tam,
        borderRadius: (MARCA_ISOTIPO.radio / lado) * tam,
        backgroundColor: MARCA_COLORES.primario,
        paddingLeft: (hoja.x / lado) * tam,
        paddingTop: (hoja.y / lado) * tam,
      }}
    >
      <Svg
        viewBox={MARCA_ISOTIPO.hojaViewBox}
        style={{ width: (hoja.ancho / lado) * tam, height: (hoja.alto / lado) * tam }}
      >
        <Path d={MARCA_ISOTIPO.path} fill={MARCA_COLORES.acento} />
      </Svg>
    </View>
  );
}
