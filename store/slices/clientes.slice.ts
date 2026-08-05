import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as clientesService from "@/services/clientes.service";
import type { ClienteDetalle, ClienteListado, ClientePayload, FiltroClientes } from "@/types";

type LoadStatus = "idle" | "loading" | "succeeded" | "failed";

interface ClientesState {
  items: ClienteListado[];
  status: LoadStatus;
  error: string | null;
  detalle: {
    data: ClienteDetalle | null;
    status: LoadStatus;
  };
}

const initialState: ClientesState = {
  items: [],
  status: "idle",
  error: null,
  detalle: { data: null, status: "idle" },
};

export const fetchClientes = createAsyncThunk<
  ClienteListado[],
  FiltroClientes,
  { rejectValue: string }
>("clientes/fetch", async (filtro, { rejectWithValue }) => {
  try {
    return await clientesService.getClientes(filtro);
  } catch {
    return rejectWithValue("No se pudieron cargar los clientes.");
  }
});

export const fetchClienteDetalle = createAsyncThunk<
  ClienteDetalle,
  number,
  { rejectValue: string }
>("clientes/detalle", async (clienteId, { rejectWithValue }) => {
  try {
    return await clientesService.getClienteDetalle(clienteId);
  } catch {
    return rejectWithValue("No se pudo cargar el cliente.");
  }
});

export const guardarCliente = createAsyncThunk<
  ClienteListado,
  ClientePayload,
  { rejectValue: string }
>("clientes/guardar", async (payload, { rejectWithValue }) => {
  try {
    return await clientesService.guardarCliente(payload);
  } catch (err) {
    return rejectWithValue(err instanceof Error ? err.message : "No se pudo guardar el cliente.");
  }
});

export const eliminarCliente = createAsyncThunk<number, number, { rejectValue: string }>(
  "clientes/eliminar",
  async (id, { rejectWithValue }) => {
    try {
      return await clientesService.eliminarCliente(id);
    } catch {
      return rejectWithValue("No se pudo dar de baja el cliente.");
    }
  },
);

const clientesSlice = createSlice({
  name: "clientes",
  initialState,
  reducers: {
    clearDetalle(state) {
      state.detalle = { data: null, status: "idle" };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchClientes.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchClientes.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.items = action.payload;
      })
      .addCase(fetchClientes.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload ?? "Error al cargar clientes.";
      })
      .addCase(fetchClienteDetalle.pending, (state) => {
        state.detalle.status = "loading";
      })
      .addCase(fetchClienteDetalle.fulfilled, (state, action) => {
        state.detalle.status = "succeeded";
        state.detalle.data = action.payload;
      })
      .addCase(fetchClienteDetalle.rejected, (state) => {
        state.detalle.status = "failed";
      })
      .addCase(guardarCliente.fulfilled, (state, action) => {
        const idx = state.items.findIndex((c) => c.id === action.payload.id);
        if (idx >= 0) state.items[idx] = action.payload;
        else state.items.unshift(action.payload);
      })
      .addCase(eliminarCliente.fulfilled, (state, action) => {
        state.items = state.items.filter((c) => c.id !== action.payload);
      });
  },
});

export const { clearDetalle } = clientesSlice.actions;
export default clientesSlice.reducer;
