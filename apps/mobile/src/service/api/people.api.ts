import { API_ROUTES } from '@/src/constants';
import { apiRequest } from '@/src/service/setup/apiClient';
import type { PeoplePage } from '@coach-connect/shared/types';

export type { PeoplePage, Person } from '@coach-connect/shared/types';

interface PeopleQuery {
  kind: 'coaches' | 'members';
  q?: string;
  specialty?: string;
  available?: boolean;
  cursor?: string;
  limit?: number;
}

/** Plain request functions (no React). */
export const peopleApi = {
  list: (accessToken: string, query: PeopleQuery) => {
    const params = Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join('&');
    return apiRequest<PeoplePage>(`${API_ROUTES.people}?${params}`, { accessToken });
  },
};
