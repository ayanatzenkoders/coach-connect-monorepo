import { StackActions, useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { chatApi } from '@/src/service/api/chat.api';
import { showApiError } from '@/src/service/setup/handleApiError';
import { withAuth } from '@/src/service/setup/withAuth';
import { canCreateGroup } from '../groupRules';
import { usePeoplePicker } from './usePeoplePicker';

/** Everything the New group screen needs: the form, the people to choose from, the choices, and creating the group. */
export const useNewGroup = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const picker = usePeoplePicker();
  const { chosen } = picker;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [titleError, setTitleError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  /** Create it, refresh the Messages list, and open the new chat (replacing this screen, so Back returns to Messages). */
  async function create() {
    if (!title.trim()) {
      setTitleError('Give the group a name.');
      return;
    }
    if (!canCreateGroup(title, chosen) || busy) return;
    setBusy(true);
    try {
      const chat = await withAuth((token) =>
        chatApi.createGroup(token, { title: title.trim(), ...(description.trim() ? { description: description.trim() } : {}), memberIds: chosen.map((p) => p.id) }),
      );
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      navigation.dispatch(StackActions.replace('Chat', { chat }));
    } catch (e) {
      showApiError(e);
    } finally {
      setBusy(false);
    }
  }

  return {
    title,
    setTitle: (value: string) => {
      setTitle(value);
      setTitleError(undefined);
    },
    titleError,
    description,
    setDescription,
    ...picker,
    canCreate: canCreateGroup(title, chosen) && !busy,
    busy,
    create,
    goBack: () => navigation.goBack(),
  };
};
