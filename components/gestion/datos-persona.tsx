"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocalidades } from "@/hooks/use-catalogos";
import { LOCALIDAD_POR_DEFECTO } from "@/lib/constants";
import type { DatosPersona } from "@/types";

/**
 * Los datos de contacto que comparten Clientes, Referentes y Cobradores.
 *
 * Un solo formulario para las tres entidades porque en la base son literalmente
 * las mismas columnas: `email`, `codigo_postal`, las DOS direcciones con su
 * "casa o departamento" cada una, `img`, `fecha_de_nacimiento` e
 * `id_localidad`. El formulario del cliente mostraba tres de ellas y el del
 * garante, dos.
 *
 * Nada de esto necesitó tocar la base: las columnas ya existían en las tres
 * tablas y los `sp_Crear*` / `sp_Editar*` ya las recibían.
 */
export function DatosPersonaFields({
  valores,
  onChange,
  prefijo,
  conLocalidad = true,
}: {
  valores: DatosPersona;
  onChange: (valores: DatosPersona) => void;
  /** Prefijo de los `id`, para que dos formularios abiertos no colisionen */
  prefijo: string;
  /** El cliente ya tiene su select de localidad al lado del de cobrador */
  conLocalidad?: boolean;
}) {
  const localidades = useLocalidades();

  const set = <K extends keyof DatosPersona>(campo: K, valor: DatosPersona[K]) =>
    onChange({ ...valores, [campo]: valor });

  /** Un input de texto que guarda null cuando queda vacío */
  const texto = (
    campo: keyof DatosPersona,
    etiqueta: string,
    extra?: React.ComponentProps<typeof Input>,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`${prefijo}-${campo}`}>{etiqueta}</Label>
      <Input
        id={`${prefijo}-${campo}`}
        value={(valores[campo] as string | null) ?? ""}
        onChange={(e) => set(campo, (e.target.value || null) as never)}
        {...extra}
      />
    </div>
  );

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {texto("email", "Email", { type: "email", placeholder: "juan@ejemplo.com" })}
        {texto("fechaNacimiento", "Fecha de nacimiento", { type: "date" })}
      </div>

      {/* ── Domicilio ── */}
      <fieldset className="space-y-3 rounded-lg border p-3">
        <legend className="px-1 text-[0.7rem] font-bold tracking-wider text-muted-foreground uppercase">
          Domicilio
        </legend>

        {texto("direccion", "Dirección", { placeholder: "Laprida 495" })}

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Un `list` y no un select: la columna es varchar y puede tener
              "Dpto 3B" cargado de antes. El datalist sugiere las dos opciones
              habituales sin impedir escribir el detalle. */}
          {texto("casaODepto1", "¿Casa o departamento?", {
            list: `${prefijo}-casa-o-dpto`,
            placeholder: "Casa",
          })}
          {texto("codigoPostal", "Código postal", { inputMode: "numeric", placeholder: "4000" })}
        </div>
      </fieldset>

      {/* ── Segunda dirección ──
          La laboral o la alternativa. Es `direccion_laboral_o_alternativa`, la
          columna que el formulario no mostraba: por eso solo se podía cargar
          una dirección de las dos que tiene la ficha. */}
      <fieldset className="space-y-3 rounded-lg border p-3">
        <legend className="px-1 text-[0.7rem] font-bold tracking-wider text-muted-foreground uppercase">
          Segunda dirección (laboral o alternativa)
        </legend>

        {texto("direccionAlternativa", "Dirección", { placeholder: "Av. Sarmiento 1200" })}
        {texto("casaODepto2", "¿Casa o departamento?", {
          list: `${prefijo}-casa-o-dpto`,
          placeholder: "Departamento",
        })}
      </fieldset>

      <datalist id={`${prefijo}-casa-o-dpto`}>
        <option value="Casa" />
        <option value="Departamento" />
      </datalist>

      {conLocalidad && (
        <div className="space-y-1.5">
          <Label htmlFor={`${prefijo}-localidad`}>Localidad</Label>
          <Select
            value={(valores.idLocalidad ?? LOCALIDAD_POR_DEFECTO).toString()}
            onValueChange={(v) => set("idLocalidad", Number(v))}
          >
            <SelectTrigger id={`${prefijo}-localidad`} className="w-full">
              <SelectValue placeholder="Elegir" />
            </SelectTrigger>
            <SelectContent>
              {localidades.map((l) => (
                <SelectItem key={l.id} value={l.id.toString()}>
                  {l.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* `img` es varchar(255): la base guarda la RUTA, no el archivo, y no hay
          endpoint de subida. Hasta que lo haya, se pega un link. */}
      {texto("img", "Foto (link)", {
        type: "url",
        placeholder: "https://…",
      })}
    </>
  );
}

/** Los `DatosPersona` de una ficha nueva: todo vacío salvo la localidad. */
export const DATOS_PERSONA_VACIOS: DatosPersona = {
  email: null,
  codigoPostal: null,
  direccion: null,
  casaODepto1: null,
  direccionAlternativa: null,
  casaODepto2: null,
  img: null,
  fechaNacimiento: null,
  // San Miguel de Tucumán: es donde está casi toda la cartera y tipearlo en
  // cada alta era trabajo de gusto.
  idLocalidad: LOCALIDAD_POR_DEFECTO,
};
