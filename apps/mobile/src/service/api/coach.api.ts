import { API_ROUTES } from '@/src/constants';
import { apiRequest } from '@/src/service/setup/apiClient';

/** Plain request functions for a coach managing their own profile (no React). */
export const coachApi = {
  /** Switch "Available now" on or off. Answers the value the server saved. */
  setAvailability: (accessToken: string, available: boolean) =>
    apiRequest<{ available: boolean }>(API_ROUTES.coaches.availability, { method: 'POST', body: { available }, accessToken }),
};
