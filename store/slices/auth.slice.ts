import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as authService from "@/services/auth.service";
import {
  clearSession,
  getStoredSession,
  getToken,
  isTokenExpired,
  persistSession,
} from "@/lib/session";
import type { Cobrador, Cuenta, LoginPayload, LoginResponse } from "@/types";

export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  cobrador: Cobrador | null;
  cuenta: Cuenta | null;
  token: string | null;
  status: AuthStatus;
  error: string | null;
}

const initialState: AuthState = {
  cobrador: null,
  cuenta: null,
  token: null,
  status: "idle",
  error: null,
};

export const login = createAsyncThunk<LoginResponse, LoginPayload, { rejectValue: string }>(
  "auth/login",
  async (payload, { rejectWithValue }) => {
    try {
      const res = await authService.login(payload);
      persistSession(res);
      return res;
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    }
  },
);

/** Restaura la sesión guardada y la valida contra la API; si expiró, vuelve al login */
export const restoreSession = createAsyncThunk<LoginResponse, void, { rejectValue: string }>(
  "auth/restore",
  async (_, { rejectWithValue }) => {
    const token = getToken();
    const session = getStoredSession();
    if (!token || !session || isTokenExpired(token)) {
      clearSession();
      return rejectWithValue("Sesión expirada.");
    }
    const valido = await authService.validateToken();
    if (!valido) {
      clearSession();
      return rejectWithValue("Sesión inválida.");
    }
    return { token, cuenta: session.cuenta, cobrador: session.cobrador };
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      clearSession();
      state.cobrador = null;
      state.cuenta = null;
      state.token = null;
      state.status = "unauthenticated";
      state.error = null;
    },
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    const authenticated = (state: AuthState, payload: LoginResponse) => {
      state.status = "authenticated";
      state.cobrador = payload.cobrador;
      state.cuenta = payload.cuenta;
      state.token = payload.token;
    };
    builder
      .addCase(login.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => authenticated(state, action.payload))
      .addCase(login.rejected, (state, action) => {
        state.status = "unauthenticated";
        state.error = action.payload ?? "No se pudo iniciar sesión.";
      })
      .addCase(restoreSession.pending, (state) => {
        state.status = "loading";
      })
      .addCase(restoreSession.fulfilled, (state, action) => authenticated(state, action.payload))
      .addCase(restoreSession.rejected, (state) => {
        state.status = "unauthenticated";
        state.cobrador = null;
        state.cuenta = null;
        state.token = null;
      });
  },
});

export const { logout, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
