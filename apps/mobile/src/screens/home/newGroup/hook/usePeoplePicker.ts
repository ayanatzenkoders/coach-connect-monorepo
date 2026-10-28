import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { peopleApi, Person } from '@/src/service/api/people.api';
import { withAuth } from '@/src/service/setup/withAuth';
import { useAuthStore } from '@/src/store/auth.store';
import { useDebounced } from '@/src/utils/hooks/useDebounced';
import { ExistingGroup, toggleChoice, whyCannotAdd } from '../groupRules';

type Kind = 'coaches' | 'members';

/**
 * The people list with search, the Coaches/Members switch and the choices, shared by "New group" and "Add people".
 * Pass `group` when adding to an existing group: its people are greyed out and the room left is smaller.
 */
export const usePeoplePicker = (group?: ExistingGroup) => {
  const iAmCoach = useAuthStore((s) => s.user?.role === 'COACH');
  const [kind, setKind] = useState<Kind>('members');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 300);
  // Kept as whole people (not just ids) so the chosen names stay on screen while I switch between Coaches and Members.
  const [chosen, setChosen] = useState<Person[]>([]);

  // The same People endpoint as the People tab, with its own cache key so the screens never disturb each other.
  const query = useInfiniteQuery({
    queryKey: ['groupPicker', kind, q],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => withAuth((token) => peopleApi.list(token, { kind, q, cursor: pageParam })),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[1] === kind ? keepPreviousData(previous) : undefined),
  });
  const people = useMemo(() => (query.data?.pages ?? []).flatMap((page) => page.items), [query.data]);

  return {
    iAmCoach,
    kind,
    setKind,
    /** Nobody to pick on the Coaches tab when the group already has its coach (or I am the coach creating it). */
    canPickCoaches: group ? !group.hasCoach : !iAmCoach,
    search,
    setSearch,
    people,
    loading: query.isPending,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
    },
    chosen,
    isChosen: (person: Person) => chosen.some((c) => c.id === person.id),
    /** null = can be added; otherwise the reason shown on the row. */
    whyDisabled: (person: Person) => whyCannotAdd(person, chosen, iAmCoach, group),
    toggle: (person: Person) => setChosen((current) => toggleChoice(current, person, iAmCoach, group)),
  };
};
