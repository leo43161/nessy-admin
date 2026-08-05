import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as planesService from "@/services/planes.service";
import type { PlanListado, PlanPayload } from "@/types";

type LoadStatus = "idle" | "loading" | "succeeded" | "failed";

interface PlanesState {
  items: PlanListado[];
  status: LoadStatus;
  error: string | null;
}

const initialState: PlanesState = { items: [], status: "idle", error: null };

export const fetchPlanes = createAsyncThunk<PlanListado[], void, { rejectValue: string }>(
  "planes/fetch",
  async (_, { rejectWithValue }) => {
    try {
      return await planesService.getPlanes();
    } catch {
      return rejectWithValue("No se pudieron cargar los planes.");
    }
  },
);

export const guardarPlan = createAsyncThunk<PlanListado, PlanPayload, { rejectValue: string }>(
  "planes/guardar",
  async (payload, { rejectWithValue }) => {
    try {
      return await planesService.guardarPlan(payload);
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : "No se pudo guardar el plan.");
    }
  },
);

export const eliminarPlan = createAsyncThunk<number, number, { rejectValue: string }>(
  "planes/eliminar",
  async (id, { rejectWithValue }) => {
    try {
      return await planesService.eliminarPlan(id);
    } catch {
      return rejectWithValue("No se pudo dar de baja el plan.");
    }
  },
);

const planesSlice = createSlice({
  name: "planes",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPlanes.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchPlanes.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.items = action.payload;
      })
      .addCase(fetchPlanes.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? "Error al cargar planes.";
      })
      .addCase(guardarPlan.fulfilled, (state, action) => {
        const idx = state.items.findIndex((p) => p.id === action.payload.id);
        if (idx >= 0) state.items[idx] = action.payload;
        else state.items.unshift(action.payload);
      })
      .addCase(eliminarPlan.fulfilled, (state, action) => {
        state.items = state.items.filter((p) => p.id !== action.payload);
      });
  },
});

export default planesSlice.reducer;
