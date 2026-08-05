import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sin esto Next sube por el árbol buscando lockfiles y termina eligiendo
  // el de C:\Users\Usuario como raíz del workspace.
  turbopack: { root: __dirname },

  // Export estático: `next build` deja HTML/CSS/JS en out/ y no queda ningún
  // proceso Node corriendo. Todo el backend es la API externa.
  //
  // Lo que esto prohíbe (y por eso el proyecto no usa nada de esto):
  // proxy.ts, route handlers, server actions, cookies()/headers(),
  // rewrites/redirects/headers de config, ISR y next/image con el loader
  // por defecto.
  output: "export",

  // El deploy es a Apache (cPanel), igual que la API. Con trailingSlash cada
  // ruta sale como `operaciones/index.html`, que Apache sirve solo por
  // DirectoryIndex. Sin esto sale `operaciones.html` y `/operaciones` da 404.
  trailingSlash: true,
};

export default nextConfig;
