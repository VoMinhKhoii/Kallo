export function isMainModule(importMeta: ImportMeta & { main?: boolean }) {
  return importMeta.main ?? false;
}
