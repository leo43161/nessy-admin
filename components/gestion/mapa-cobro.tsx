"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import type { Map as MapaLeaflet, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatearPunto, parsearPunto, type Punto } from "@/lib/coordenadas";

/** San Miguel de Tucumán: donde está la cartera */
const CENTRO: Punto = { lat: -26.8241, lon: -65.2226 };

/**
 * Nominatim (el geocoder de OpenStreetMap) es gratis y sin API key, pero pide
 * como máximo 1 consulta por segundo. Por eso el pin no consulta mientras se
 * arrastra: espera a que el usuario suelte y pare.
 */
const NOMINATIM = "https://nominatim.openstreetmap.org";
const ESPERA_MS = 800;

interface MapaCobroProps {
  /** "lat,lon" o null */
  valor: string | null;
  onChange: (valor: string | null) => void;
}

/**
 * Elección del punto de cobro con un pin sobre el mapa.
 *
 * Lo único que se guarda son las coordenadas: el input de dirección es una
 * referencia para quien coloca el pin y va en los dos sentidos —mover el pin
 * escribe la dirección, escribir una dirección mueve el pin—, pero su texto
 * no se persiste en ningún lado.
 */
export function MapaCobro({ valor, onChange }: MapaCobroProps) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaLeaflet | null>(null);
  const pin = useRef<Marker | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cada consulta se numera: si el usuario mueve el pin otra vez, la respuesta
  // vieja llega tarde y no debe pisar el texto de la nueva.
  const consulta = useRef(0);

  const [direccion, setDireccion] = useState("");
  const [buscando, setBuscando] = useState(false);

  /** Guarda el punto y trae la dirección que le corresponde */
  const fijar = (p: Punto) => {
    onChange(formatearPunto(p));
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => geocodificarInverso(p), ESPERA_MS);
  };

  const geocodificarInverso = async (p: Punto) => {
    const nro = ++consulta.current;
    setBuscando(true);
    try {
      const r = await fetch(`${NOMINATIM}/reverse?format=json&lat=${p.lat}&lon=${p.lon}`, {
        headers: { Accept: "application/json" },
      });
      const json = await r.json();
      if (nro === consulta.current) setDireccion(json?.display_name ?? "");
    } catch {
      // Sin internet o Nominatim caído: el pin ya quedó puesto, que es lo que
      // se guarda. La dirección es solo la referencia visual.
    } finally {
      if (nro === consulta.current) setBuscando(false);
    }
  };

  /** Dirección escrita → mueve el pin */
  const buscarDireccion = async () => {
    const q = direccion.trim();
    if (!q) return;
    const nro = ++consulta.current;
    setBuscando(true);
    try {
      const r = await fetch(
        `${NOMINATIM}/search?format=json&limit=1&countrycodes=ar&q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/json" } },
      );
      const [hit] = await r.json();
      if (nro !== consulta.current) return;
      if (!hit) return;

      const p = { lat: Number(hit.lat), lon: Number(hit.lon) };
      pin.current?.setLatLng([p.lat, p.lon]);
      mapa.current?.setView([p.lat, p.lon], 17);
      onChange(formatearPunto(p));
    } catch {
      // idem: sin resultado el pin se queda donde estaba
    } finally {
      if (nro === consulta.current) setBuscando(false);
    }
  };

  // Leaflet toca el DOM directo, así que se inicializa una sola vez al montar.
  // Importado dinámico porque el build es export estático: en el prerender no
  // hay window y el paquete lo toca al cargarse.
  useEffect(() => {
    let vivo = true;

    (async () => {
      const L = (await import("leaflet")).default;
      if (!vivo || !contenedor.current || mapa.current) return;

      const inicial = parsearPunto(valor);
      const centro = inicial ?? CENTRO;
      const m = L.map(contenedor.current).setView([centro.lat, centro.lon], inicial ? 17 : 13);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(m);

      // divIcon y no el marcador por defecto: el icono de Leaflet es un PNG que
      // se pide a la raíz del dominio, y esta app se despliega bajo /nessyadmin
      // (basePath), así que llegaría 404 y el pin quedaría invisible.
      const icono = L.divIcon({
        className: "",
        html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:var(--primary,#ea580c);border:2px solid #fff;box-shadow:0 1px 4px rgb(0 0 0 / .4)"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
      });

      const marcador = L.marker([centro.lat, centro.lon], { draggable: true, icon: icono }).addTo(m);
      marcador.on("dragend", () => {
        const { lat, lng } = marcador.getLatLng();
        fijar({ lat, lon: lng });
      });
      m.on("click", (e) => {
        marcador.setLatLng(e.latlng);
        fijar({ lat: e.latlng.lat, lon: e.latlng.lng });
      });

      mapa.current = m;
      pin.current = marcador;

      // El diálogo entra con una animación de escala: si Leaflet mide el
      // contenedor antes de que termine, los tiles quedan cortados.
      setTimeout(() => m.invalidateSize(), 150);

      // Ficha nueva: el pin se ve en el centro de la ciudad pero el valor sigue
      // en null hasta que lo toquen. Darlo por elegido guardaría a todos los
      // clientes nuevos en la misma esquina y el control de rango sería falso.
      if (inicial) geocodificarInverso(inicial);
    })();

    return () => {
      vivo = false;
      if (temporizador.current) clearTimeout(temporizador.current);
      mapa.current?.remove();
      mapa.current = null;
      pin.current = null;
    };
    // Solo al montar: el valor lo maneja este componente de acá en adelante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-1.5">
      <Label>Dónde se cobra</Label>

      <div
        ref={contenedor}
        className="h-56 w-full overflow-hidden rounded-md border"
        // Leaflet pinta el mapa dentro de un contenedor propio y sus paneles se
        // superponen a los overlays de Radix si no se los baja.
        style={{ zIndex: 0 }}
      />

      <div className="flex gap-2">
        <Input
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          onKeyDown={(e) => {
            // El form de cliente envuelve todo esto: sin preventDefault, Enter
            // acá guardaría el cliente en vez de buscar la dirección.
            if (e.key === "Enter") {
              e.preventDefault();
              buscarDireccion();
            }
          }}
          placeholder="Laprida 505, San Miguel de Tucumán"
          aria-label="Buscar dirección"
        />
        <Button type="button" variant="outline" onClick={buscarDireccion} disabled={buscando}>
          {buscando ? <Loader2 className="animate-spin" /> : <Search />}
          <span className="sr-only">Buscar</span>
        </Button>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="size-3.5 shrink-0" />
        {valor
          ? `Punto de cobro: ${valor}`
          : "Tocá el mapa o arrastrá el pin. Se guardan las coordenadas, no el texto."}
      </p>
    </div>
  );
}
