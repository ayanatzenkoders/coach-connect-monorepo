import { useCallback, useEffect, useRef, useState } from 'react';
import { peopleApi, Person } from '../api/peopleApi';
import { withAuth } from '../api/withAuth';
import { showApiError } from '../toast/toastStore';
import { useDebounced } from './useDebounced';

export interface PeopleFilters {
  kind: 'coaches' | 'members';
  /** What the user typed; sent to the server 300 ms after typing stops. */
  q: string;
  /** Coaches tab only. */
  specialty?: string;
  availableOnly: boolean;
}

interface State {
  /** Which tab `items` belong to, so a stale list is never shown under the wrong tab. */
  kind: PeopleFilters['kind'];
  items: Person[];
  total: number;
  nextCursor: string | null;
  specialties: string[];
  /** First page (or a new search) is loading. */
  loading: boolean;
  /** Next page is loading. */
  loadingMore: boolean;
}

const EMPTY: State = { kind: 'coaches', items: [], total: 0, nextCursor: null, specialties: [], loading: true, loadingMore: false };

/**
 * Loads the People list for the current tab, search text and filters, and the next pages on demand.
 * Whenever a filter changes the list starts again from page 1.
 */
export function usePeople(filters: PeopleFilters) {
  const { kind, specialty, availableOnly } = filters;
  const q = useDebounced(filters.q.trim(), 300);
  const [state, setState] = useState<State>(EMPTY);
  // Every request gets a number; an answer that is not for the newest request is dropped
  // (otherwise a slow answer for "am" could overwrite the answer for "amara").
  const latest = useRef(0);

  const run = useCallback(
    async (cursor: string | null) => {
      const id = ++latest.current;
      setState((s) => ({ ...s, kind: cursor ? s.kind : kind, items: cursor || s.kind === kind ? s.items : [], loading: !cursor, loadingMore: !!cursor }));
      try {
        const page = await withAuth((token) =>
          peopleApi.list(token, {
            kind,
            q,
            cursor: cursor ?? undefined,
            ...(kind === 'coaches' && { specialty, available: availableOnly ? true : undefined }),
          }),
        );
        if (id !== latest.current) return;
        setState((s) => ({
          kind,
          items: cursor ? [...s.items, ...page.items] : page.items,
          total: page.total,
          nextCursor: page.nextCursor,
          specialties: page.specialties ?? s.specialties,
          loading: false,
          loadingMore: false,
        }));
      } catch (e) {
        if (id !== latest.current) return;
        showApiError(e);
        setState((s) => ({ ...s, loading: false, loadingMore: false }));
      }
    },
    [kind, q, specialty, availableOnly],
  );

  useEffect(() => {
    run(null);
  }, [run]);

  const { nextCursor, loading, loadingMore } = state;
  const loadMore = useCallback(() => {
    if (nextCursor && !loading && !loadingMore) run(nextCursor);
  }, [nextCursor, loading, loadingMore, run]);

  const refresh = useCallback(() => run(null), [run]);

  return { ...state, items: state.kind === kind ? state.items : [], loadMore, refresh };
}
