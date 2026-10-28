// Convenience barrel for Node/Next consumers. On mobile import a subpath instead
// ("@coach-connect/shared/api", "/schemas", "/types"): Metro does not tree-shake, so the
// root barrel would pull zod into the bundle even when you only need a constant.
export * from "./api";
export * from "./constants";
export * from "./schemas";
export * from "./types";
export * from "./realtime";
