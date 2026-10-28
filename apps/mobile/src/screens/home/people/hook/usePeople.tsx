import { useNavigation } from '@react-navigation/native';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chatApi } from '@/src/service/api/chat.api';
import { peopleApi, Person } from '@/src/service/api/people.api';
import { showApiError } from '@/src/service/setup/handleApiError';
import { withAuth } from '@/src/service/setup/withAuth';
import { showToast } from '@/src/store/toast.store';
import { useDebounced } from '@/src/utils/hooks/useDebounced';

type PeopleKind = 'coaches' | 'members';

/** Everything the People screen needs: the tab, search and filters, the list, paging and the row buttons. */
export const usePeople = () => {
  const navigation = useNavigation();
  const [kind, setKind] = useState<PeopleKind>('coaches');
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState<string | undefined>();
  const [availableOnly, setAvailableOnly] = useState(false);

  const isCoaches = kind === 'coaches';
  // The text is sent to the server 300 ms after typing stops, not on every keystroke.
  const q = useDebounced(search.trim(), 300);

  // Coach-only filters are not part of the key on the Members tab, so they cannot refetch it.
  const queryKey = ['people', kind, q, isCoaches ? specialty : undefined, isCoaches ? availableOnly : false] as const;

  // True only while the user is pulling down to refresh. It is NOT "the list is loading": the pull-to-refresh
  // spinner pushes the whole list down, so showing it for every search or filter made the list jump.
  const [pulling, setPulling] = useState(false);

  const query = useInfiniteQuery({
    queryKey,
    // Answers stay fresh for 20 s: going back to a filter you just used shows it instantly, without
    // a second request that would redraw the list under your finger.
    staleTime: 20_000,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      withAuth((token) =>
        peopleApi.list(token, { kind, q, cursor: pageParam, ...(isCoaches && { specialty, available: availableOnly ? true : undefined }) }),
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // While a new search loads, keep showing the old list of the SAME tab (but never another tab's list).
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[1] === kind ? keepPreviousData(previous) : undefined),
  });

  useEffect(() => {
    if (query.error) showApiError(query.error);
  }, [query.error]);

  const pages = query.data?.pages ?? [];
  // The SAME array until the data really changes. Rebuilding it on every keystroke made the list redraw every row.
  const items = useMemo(() => (query.data?.pages ?? []).flatMap((page) => page.items), [query.data]);
  const total = pages[pages.length - 1]?.total ?? 0;

  // The specialty chips only come with coach answers; remember them while the Members tab is open.
  const chips = useRef<string[]>([]);
  if (pages[0]?.specialties) chips.current = pages[0].specialties;

  const noun = isCoaches ? (total === 1 ? 'coach' : 'coaches') : total === 1 ? 'member' : 'members';

  /** The chat button: open (or create) the chat, then show the chat on top of the tabs. */
  // useCallback: the same function every render, so rows (React.memo) are not redrawn just because the search box changed.
  const message = useCallback(
    async (person: Person) => {
      try {
        const chat = await withAuth((token) => chatApi.open(token, person.id));
        navigation.navigate('Chat', { chat });
      } catch (e) {
        showApiError(e);
      }
    },
    [navigation],
  );
  const call = useCallback((person: Person) => showToast(`Calling ${person.name} is coming soon.`, 'info'), []);

  return {
    kind,
    setKind,
    isCoaches,
    search,
    setSearch,
    specialty,
    toggleSpecialty: (s: string) => setSpecialty((current) => (current === s ? undefined : s)),
    availableOnly,
    toggleAvailableOnly: () => setAvailableOnly((v) => !v),
    specialties: chips.current,
    items,
    total,
    noun,
    filtered: search.trim() !== '' || !!specialty || availableOnly,
    loading: query.isPending,
    loadingMore: query.isFetchingNextPage,
    refreshing: pulling,
    /** Identifies WHICH search/filter the rows belong to; the screen scrolls to the top when it changes. */
    resultsKey: JSON.stringify(queryKey),
    /** The rows on screen are still the previous search's while the new one loads. */
    stale: query.isPlaceholderData,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
    },
    refresh: async () => {
      setPulling(true);
      try {
        await query.refetch();
      } finally {
        setPulling(false);
      }
    },
    message,
    call,
  };
};
