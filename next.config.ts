import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sin esto Next sube por el árbol buscando lockfiles y termina eligiendo
  // el de C:\Users\Usuario como raíz del workspace.
  turbopack: { root: __dirname },
};

export default nextConfig;
