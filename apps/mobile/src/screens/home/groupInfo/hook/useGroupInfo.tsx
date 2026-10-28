import { StackActions, useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { GROUP_MAX_MEMBERS } from '@/src/constants';
import { chatApi } from '@/src/service/api/chat.api';
import { showApiError } from '@/src/service/setup/handleApiError';
import { patchChatsCache } from '../../messages/hook/useUnreadTotal';
import { removeChat } from '../../messages/chatsCache';
import { withAuth } from '@/src/service/setup/withAuth';
import { useAuthStore } from '@/src/store/auth.store';
import { showToast } from '@/src/store/toast.store';

/** The group info screen: the description and the people in the group. */
export const useGroupInfo = (chatId: string) => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const meId = useAuthStore((s) => s.user?.id ?? '');
  const query = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => withAuth((token) => chatApi.detail(token, chatId)),
    retry: false,
  });
  const detail = query.data ?? null;

  // The coach first (there is at most one), then everybody by name.
  const members = useMemo(() => [...(detail?.members ?? [])].sort((a, b) => Number(b.role === 'COACH') - Number(a.role === 'COACH') || a.name.localeCompare(b.name)), [detail]);
  const createdBy = detail?.members.find((m) => m.id === detail.createdById)?.name ?? null;

  /** Only the creator manages the group (the server decides: `canManage`). Adding needs room, so the button hides when it is full. */
  const canManage = detail?.canManage === true;
  const canAdd = canManage && (detail?.memberCount ?? GROUP_MAX_MEMBERS) < GROUP_MAX_MEMBERS;

  /** Delete for everybody, messages included. Back to the tab bar: the chat and this screen are gone. */
  async function deleteGroup() {
    setDeleting(true);
    try {
      await withAuth((token) => chatApi.deleteGroup(token, chatId));
      patchChatsCache(queryClient, (chats) => removeChat(chats, chatId));
      queryClient.removeQueries({ queryKey: ['chat', chatId] });
      // The delete push can reach this phone first and already have sent me back to the tab bar: then this screen is gone, nothing to pop.
      if (navigation.isFocused()) navigation.dispatch(StackActions.popToTop());
      showToast('Group deleted.', 'success');
    } catch (e) {
      showApiError(e);
    } finally {
      setDeleting(false);
    }
  }

  return {
    meId,
    canManage,
    canAdd,
    deleting,
    addPeople: () => {
      if (detail) navigation.navigate('AddMembers', { chatId, memberIds: detail.members.map((m) => m.id), memberCount: detail.memberCount, hasCoach: detail.members.some((m) => m.role === 'COACH') });
    },
    confirmDelete: () =>
      Alert.alert('Delete this group?', 'It is deleted for everyone, and all its messages are gone for good.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete group', style: 'destructive', onPress: deleteGroup },
      ]),
    detail,
    members,
    createdBy,
    loading: query.isPending,
    failed: query.isError && !detail,
    reload: () => query.refetch(),
    call: () => showToast('Group calls are coming soon.', 'info'),
    goBack: () => navigation.goBack(),
  };
};
