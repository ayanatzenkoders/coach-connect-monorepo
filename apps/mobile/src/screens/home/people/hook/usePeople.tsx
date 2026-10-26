import { useNavigation } from '@react-navigation/native';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { chatApi } from '@/src/service/api/chat.api';
import { peopleApi, Person } from '@/src/service/api/people.api';
import { showApiError } from '@/src/service/setup/handleApiError';
import { withAuth } from '@/src/service/setup/withAuth';
import { showToast } from '@/src/store/toast.store';
import { useDebounced } from '@/src/utils/hooks/useDebounced';

export type PeopleKind = 'coaches' | 'members';

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

  const query = useInfiniteQuery({
    // Coach-only filters are not part of the key on the Members tab, so they cannot refetch it.
    queryKey: ['people', kind, q, isCoaches ? specialty : undefined, isCoaches ? availableOnly : false],
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
  const items = pages.flatMap((page) => page.items);
  const total = pages[pages.length - 1]?.total ?? 0;

  // The specialty chips only come with coach answers; remember them while the Members tab is open.
  const chips = useRef<string[]>([]);
  if (pages[0]?.specialties) chips.current = pages[0].specialties;

  const noun = isCoaches ? (total === 1 ? 'coach' : 'coaches') : total === 1 ? 'member' : 'members';

  /** The chat button: open (or create) the conversation, then show the chat on top of the tabs. */
  async function message(person: Person) {
    try {
      const conversation = await withAuth((token) => chatApi.open(token, person.id));
      navigation.navigate('Chat', { conversation });
    } catch (e) {
      showApiError(e);
    }
  }

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
    refreshing: query.isFetching && !query.isFetchingNextPage && items.length > 0,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
    },
    refresh: () => query.refetch(),
    message,
    call: (person: Person) => showToast(`Calling ${person.name} is coming soon.`, 'info'),
  };
};
