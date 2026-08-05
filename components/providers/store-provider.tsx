"use client";

import { useState } from "react";
import { Provider } from "react-redux";
import { makeStore } from "@/store";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // Inicialización perezosa: un único store por montaje de la app
  const [store] = useState(makeStore);
  return <Provider store={store}>{children}</Provider>;
}
