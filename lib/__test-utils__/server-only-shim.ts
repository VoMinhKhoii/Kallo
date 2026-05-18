// Vite/Vitest can't resolve Next.js's `server-only` package on its own
// because it lives under next/dist/compiled and isn't published as a
// top-level module. This empty shim is aliased to "server-only" in
// vitest.config.ts so tests transform cleanly without depending on the
// vite optimizeDeps cache.
export {};
