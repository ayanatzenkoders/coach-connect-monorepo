import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { GROUP_MAX_MEMBERS } from '@/src/constants';
import { chatApi } from '@/src/service/api/chat.api';
import { showApiError } from '@/src/service/setup/handleApiError';
import { withAuth } from '@/src/service/setup/withAuth';
import { showToast } from '@/src/store/toast.store';
import { usePeoplePicker } from '../../newGroup/hook/usePeoplePicker';

interface Params {
  chatId: string;
  memberIds: string[];
  memberCount: number;
  hasCoach: boolean;
}

/** Add people to a group I created: the same picker as New group, but the people already in it are greyed out. */
export const useAddMembers = ({ chatId, memberIds, memberCount, hasCoach }: Params) => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const picker = usePeoplePicker({ memberIds, memberCount, hasCoach });
  const [busy, setBusy] = useState(false);
  const total = memberCount + picker.chosen.length;

  async function add() {
    if (picker.chosen.length === 0 || busy) return;
    setBusy(true);
    try {
      // The server re-checks size and the one-coach rule under a lock, so two people adding at once cannot break them.
      const detail = await withAuth((token) =>
        chatApi.addMembers(
          token,
          chatId,
          picker.chosen.map((p) => p.id),
        ),
      );
      queryClient.setQueryData(['chat', chatId], detail); // the Group info screen behind us shows the new people at once
      queryClient.invalidateQueries({ queryKey: ['chats'] });
      showToast(picker.chosen.length === 1 ? 'Added to the group.' : `${picker.chosen.length} people added.`, 'success');
      navigation.goBack();
    } catch (e) {
      showApiError(e);
    } finally {
      setBusy(false);
    }
  }

  return {
    ...picker,
    total,
    max: GROUP_MAX_MEMBERS,
    canAdd: picker.chosen.length > 0 && !busy,
    busy,
    add,
    goBack: () => navigation.goBack(),
  };
};
