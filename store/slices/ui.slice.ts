import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { RANGO_KEY } from "@/lib/constants";
import { todayISO } from "@/lib/format";
import type { RangoFechas } from "@/types";

export type ModoFecha = "dia" | "rango";

interface UiState {
  modo: ModoFecha;
  /** Filtro de fecha de la topbar. En modo "día", hasta === desde. */
  rango: RangoFechas | null;
}

const initialState: UiState = {
  modo: "dia",
  rango: null,
};

/** El rango se persiste para que recargar la página no vuelva a hoy */
function persistir(state: UiState) {
  if (typeof window !== "undefined" && state.rango) {
    localStorage.setItem(RANGO_KEY, JSON.stringify({ modo: state.modo, rango: state.rango }));
  }
}

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    /** Restaura el filtro guardado, o arranca en el día de hoy */
    initRango(state) {
      if (state.rango) return;
      const guardado = typeof window !== "undefined" ? localStorage.getItem(RANGO_KEY) : null;
      if (guardado) {
        try {
          const { modo, rango } = JSON.parse(guardado) as { modo: ModoFecha; rango: RangoFechas };
          state.modo = modo;
          state.rango = rango;
          return;
        } catch {
          // filtro corrupto: se ignora y se arranca en hoy
        }
      }
      const hoy = todayISO();
      state.rango = { desde: hoy, hasta: hoy };
    },

    setModo(state, action: PayloadAction<ModoFecha>) {
      state.modo = action.payload;
      // Al volver a "día" el rango colapsa en su fecha de inicio
      if (action.payload === "dia" && state.rango) {
        state.rango = { desde: state.rango.desde, hasta: state.rango.desde };
      }
      persistir(state);
    },

    setDesde(state, action: PayloadAction<string>) {
      const desde = action.payload;
      const hasta = state.modo === "dia" ? desde : (state.rango?.hasta ?? desde);
      // Un "hasta" anterior al "desde" daría un rango vacío: se arrastra
      state.rango = { desde, hasta: hasta < desde ? desde : hasta };
      persistir(state);
    },

    /** Un período entero de una: "esta semana", "el mes pasado"… */
    setRango(state, action: PayloadAction<RangoFechas>) {
      state.rango = action.payload;
      state.modo = action.payload.desde === action.payload.hasta ? "dia" : "rango";
      persistir(state);
    },

    setHasta(state, action: PayloadAction<string>) {
      if (!state.rango) return;
      const hasta = action.payload;
      state.rango = {
        desde: state.rango.desde,
        hasta: hasta < state.rango.desde ? state.rango.desde : hasta,
      };
      persistir(state);
    },
  },
});

export const { initRango, setModo, setRango, setDesde, setHasta } = uiSlice.actions;
export default uiSlice.reducer;
