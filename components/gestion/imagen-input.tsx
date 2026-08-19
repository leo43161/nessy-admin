"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, ImageUp, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { subirImagen, urlDeImagen } from "@/services/imagenes.service";

/** Lo mismo que acepta la API. El navegador filtra antes de gastar la subida. */
const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * La foto de una persona: se arrastra, se elige del disco o se saca en el momento.
 *
 * Un solo componente para las dos formas de trabajar, porque el panel se usa
 * desde las dos:
 *
 *   · **Escritorio** — el recuadro recibe la imagen arrastrada, y si no, está
 *     el botón de elegir archivo.
 *   · **Celular** — "Sacar foto" abre la cámara directo (`capture`), y "Elegir"
 *     abre la galería. Son dos `input file` distintos y no uno con un menú:
 *     el atributo `capture` es lo único que hace que el sistema saltee el
 *     selector y vaya a la cámara, y no se puede decidir al vuelo.
 *
 * El arrastre no se esconde en el celular ni la cámara en escritorio: en
 * escritorio el `capture` se ignora y abre el selector de archivos —que es lo
 * razonable—, y en el celular el recuadro sigue siendo el área táctil grande.
 * Menos ramas, y ninguna pantalla queda sin salida.
 *
 * Sube al soltar y devuelve la RUTA, no el archivo: `Clientes.img` guarda
 * dónde está la foto. Así el formulario se guarda con un campo de texto más y
 * no hay que armar un multipart en el alta.
 */
export function ImagenInput({
  valor,
  onChange,
  etiqueta = "Foto",
}: {
  /** La ruta guardada, o null */
  valor: string | null;
  onChange: (ruta: string | null) => void;
  etiqueta?: string;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [encima, setEncima] = useState(false);
  const desdeArchivo = useRef<HTMLInputElement>(null);
  const desdeCamara = useRef<HTMLInputElement>(null);

  const url = urlDeImagen(valor);

  const procesar = async (archivo: File | undefined) => {
    if (!archivo) return;

    // Se avisa acá y no después de subir: el celular tarda en mandar 4 MB por
    // datos móviles, y enterarse al final de que no servía es peor que no
    // haberlo intentado.
    if (!TIPOS.includes(archivo.type)) {
      toast.error("Tiene que ser una imagen JPG, PNG o WEBP.");
      return;
    }
    if (archivo.size > MAX_BYTES) {
      toast.error(`La imagen pesa ${(archivo.size / 1048576).toFixed(1)} MB. El máximo es 5 MB.`);
      return;
    }

    setSubiendo(true);
    try {
      const { ruta } = await subirImagen(archivo);
      onChange(ruta);
      toast.success("Foto cargada.");
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "No se pudo subir la foto.";
      toast.error(msg);
    } finally {
      setSubiendo(false);
      // Se limpia el input: si no, elegir el MISMO archivo otra vez no dispara
      // `change` y parece que el botón dejó de andar.
      if (desdeArchivo.current) desdeArchivo.current.value = "";
      if (desdeCamara.current) desdeCamara.current.value = "";
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>{etiqueta}</Label>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          procesar(e.dataTransfer.files[0]);
        }}
        // El recuadro entero abre el selector: en el celular es el área táctil
        // grande, y en escritorio es lo que se espera de un dropzone.
        onClick={() => !subiendo && desdeArchivo.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors",
          encima ? "border-primary bg-primary/5" : "border-input hover:bg-secondary/50",
          subiendo && "pointer-events-none opacity-60",
        )}
      >
        {subiendo ? (
          <>
            <Loader2 className="size-7 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Subiendo…</p>
          </>
        ) : url ? (
          <>
            {/* `<img>` y no next/image: el export estático no tiene optimizador
                y la foto sale de la API, que no está en `remotePatterns`. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={etiqueta}
              className="max-h-40 w-auto rounded-md object-contain"
            />
            <p className="text-[0.7rem] text-muted-foreground">
              Tocá para cambiarla, o arrastrá otra encima.
            </p>
          </>
        ) : (
          <>
            <ImageUp className="size-7 text-muted-foreground" />
            <p className="text-xs font-medium">Arrastrá una foto o tocá para elegirla</p>
            <p className="text-[0.7rem] text-muted-foreground">JPG, PNG o WEBP · hasta 5 MB</p>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={subiendo}
          onClick={() => desdeCamara.current?.click()}
        >
          <Camera />
          Sacar foto
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={subiendo}
          onClick={() => desdeArchivo.current?.click()}
        >
          <Upload />
          Elegir archivo
        </Button>
        {valor && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={subiendo}
            onClick={() => onChange(null)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 />
            Quitar
          </Button>
        )}
      </div>

      {/* Los dos inputs, ocultos. `capture="environment"` pide la cámara
          trasera —la foto es del cliente o de su casa, no una selfie—; en
          escritorio el atributo se ignora y abre el selector de archivos. */}
      <input
        ref={desdeArchivo}
        type="file"
        accept={TIPOS.join(",")}
        className="hidden"
        onChange={(e) => procesar(e.target.files?.[0])}
      />
      <input
        ref={desdeCamara}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => procesar(e.target.files?.[0])}
      />
    </div>
  );
}
