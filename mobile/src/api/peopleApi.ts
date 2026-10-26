import { apiRequest } from './client';

/** Mirrors GET /people (backend/src/people/people.service.ts). Never contains an email. */
export interface Person {
  id: string;
  name: string;
  role: 'MEMBER' | 'COACH';
  /** Coaches only: */
  bio?: string;
  specialties?: string[];
  available?: boolean;
}

export interface PeoplePage {
  items: Person[];
  /** Everyone matching the filters, not just this page. */
  total: number;
  /** Send back as `cursor` for the next page; null = this was the last page. */
  nextCursor: string | null;
  /** Coaches tab only: every specialty on offer (the filter chips). */
  specialties?: string[];
}

export interface PeopleQuery {
  kind: 'coaches' | 'members';
  q?: string;
  specialty?: string;
  available?: boolean;
  cursor?: string;
  limit?: number;
}

export const peopleApi = {
  list: (accessToken: string, query: PeopleQuery) => {
    const params = Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join('&');
    return apiRequest<PeoplePage>(`/people?${params}`, { accessToken });
  },
};
