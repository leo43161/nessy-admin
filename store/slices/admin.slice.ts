import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as adminService from "@/services/admin.service";
import { getCobradores } from "@/services/cobradores.service";
import type { Cobrador, CobroDelDia, RangoFechas } from "@/types";

type LoadStatus = "idle" | "loading" | "succeeded" | "failed";

interface AdminState {
  /** Cuotas del período seleccionado (Operaciones + Cierre) */
  periodo: { items: CobroDelDia[]; status: LoadStatus; error: string | null };
  /** Histórico completo, sin filtro de fecha (Análisis) */
  historico: { items: CobroDelDia[]; status: LoadStatus };
  /** Catálogo estable durante la sesión; ordena las columnas y los colores */
  cobradores: { items: Cobrador[]; status: LoadStatus };
}

const initialState: AdminState = {
  periodo: { items: [], status: "idle", error: null },
  historico: { items: [], status: "idle" },
  cobradores: { items: [], status: "idle" },
};

export const fetchPeriodo = createAsyncThunk<CobroDelDia[], RangoFechas, { rejectValue: string }>(
  "admin/periodo",
  async (rango, { rejectWithValue }) => {
    try {
      return await adminService.getCobrosDelPeriodo(rango);
    } catch {
      return rejectWithValue("No se pudieron cargar los cobros del período.");
    }
  },
);

export const fetchHistorico = createAsyncThunk<CobroDelDia[]>("admin/historico", () =>
  adminService.getHistorico(),
);

export const fetchCobradores = createAsyncThunk<Cobrador[]>("admin/cobradores", () =>
  getCobradores(),
);

const adminSlice = createSlice({
  name: "admin",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPeriodo.pending, (state) => {
        state.periodo.status = "loading";
        state.periodo.error = null;
      })
      .addCase(fetchPeriodo.fulfilled, (state, action) => {
        state.periodo.status = "succeeded";
        state.periodo.items = action.payload;
      })
      .addCase(fetchPeriodo.rejected, (state, action) => {
        state.periodo.status = "failed";
        state.periodo.error = action.payload ?? "Error al cargar el período.";
      })
      .addCase(fetchHistorico.pending, (state) => {
        state.historico.status = "loading";
      })
      .addCase(fetchHistorico.fulfilled, (state, action) => {
        state.historico.status = "succeeded";
        state.historico.items = action.payload;
      })
      .addCase(fetchHistorico.rejected, (state) => {
        state.historico.status = "failed";
      })
      .addCase(fetchCobradores.pending, (state) => {
        state.cobradores.status = "loading";
      })
      .addCase(fetchCobradores.fulfilled, (state, action) => {
        state.cobradores.status = "succeeded";
        state.cobradores.items = action.payload;
      })
      .addCase(fetchCobradores.rejected, (state) => {
        state.cobradores.status = "failed";
      });
  },
});

export default adminSlice.reducer;
