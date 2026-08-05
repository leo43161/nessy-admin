import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

interface InitialsAvatarProps {
  nombre: string;
  /** Color pleno de fondo (CSS). Sin él usa el color de marca. */
  color?: string;
  size?: "xs" | "sm" | "md";
  className?: string;
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
export function InitialsAvatar({ nombre, color, size = "sm", className }: InitialsAvatarProps) {
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
