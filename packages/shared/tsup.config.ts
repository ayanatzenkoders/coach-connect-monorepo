import { defineConfig } from "tsup";

// Dual ESM + CJS output so Metro, Next.js and NestJS can all consume it.
export default defineConfig({
  // One entry per subpath export (see package.json "exports").
  entry: {
    index: "src/index.ts",
    api: "src/api.ts",
    constants: "src/constants.ts",
    schemas: "src/schemas/index.ts",
    types: "src/types.ts",
    realtime: "src/realtime.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
});
