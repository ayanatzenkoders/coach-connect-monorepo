// The REST route contract is shared with the API (packages/shared). Import the `/api` subpath:
// the root `@coach-connect/shared` barrel would pull zod into the bundle (Metro does not tree-shake).
export { API_ROUTES, withParams } from '@coach-connect/shared/api';
