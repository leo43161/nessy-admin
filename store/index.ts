import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/auth.slice";
import uiReducer from "./slices/ui.slice";
import adminReducer from "./slices/admin.slice";
import clientesReducer from "./slices/clientes.slice";
import planesReducer from "./slices/planes.slice";

export function makeStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      ui: uiReducer,
      admin: adminReducer,
      clientes: clientesReducer,
      planes: planesReducer,
    },
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
