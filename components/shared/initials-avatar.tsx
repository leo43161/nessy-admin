import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { urlDeImagen } from "@/services/imagenes.service";

interface InitialsAvatarProps {
  nombre: string;
  /** Color pleno de fondo (CSS). Sin él usa el color de marca. */
  color?: string;
  size?: "xs" | "sm" | "md";
  className?: string;
  /**
   * `Clientes.img`, si la ficha tiene foto cargada.
   *
   * Con foto se muestra la foto; sin foto, las iniciales de siempre. Es una
   * prop opcional para no tener que tocar los quince lugares que ya usan este
   * avatar sin imagen —el kanban, los ledgers, los listados—, donde además la
   * inicial de color identifica al cobrador y una foto no aportaría nada.
   */
  img?: string | null;
}

const SIZES = {
  xs: "size-6.5 rounded-md text-[0.6rem]",
  sm: "size-9 rounded-[0.6rem] text-xs",
  md: "size-10 rounded-xl text-sm",
};

/**
 * Avatar cuadrado con iniciales. En el kanban y los ledgers el color
 * identifica al cobrador, así que se pasa desde el agregado.
 */
export function InitialsAvatar({
  nombre,
  color,
  size = "sm",
  className,
  img,
}: InitialsAvatarProps) {
  const foto = urlDeImagen(img ?? null);

  if (foto) {
    return (
      // `<img>` y no next/image: el export estático no lleva optimizador y la
      // foto sale de la API, que no está en `remotePatterns`.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={foto}
        alt={nombre}
        className={cn("shrink-0 object-cover", SIZES[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center font-bold text-white",
        SIZES[size],
        !color && "bg-primary",
        className,
      )}
      style={color ? { background: color } : undefined}
    >
      {initials(nombre)}
    </div>
  );
}
