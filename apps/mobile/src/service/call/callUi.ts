import type { CallInfo, CallParticipantInfo } from '@/src/service/api/call.api';

/** Who is in the call right now (joined and not left). */
export const connectedCount = (call: CallInfo): number => call.participants.filter((p) => p.joinedAt && !p.leftAt).length;

/** The word shown next to each person in the call. */
export function participantLabel(p: CallParticipantInfo): string {
  switch (p.status) {
    case 'JOINED':
      return p.leftAt ? 'Left' : 'In call';
    case 'INVITED':
      return 'Ringing…';
    case 'DECLINED':
      return 'Declined';
    case 'MISSED':
      return 'Missed';
    case 'BUSY':
      return 'On another call';
  }
}

/** A direct call is titled with the other person's name; a group call is just "Group call". */
export function callTitle(call: CallInfo, meId: string): string {
  if (call.participants.length > 2) return 'Group call';
  return call.participants.find((p) => p.userId !== meId)?.name ?? 'Call';
}

/** 75000 -> "1:15", 3_725_000 -> "1:02:05". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

/** The call is still going (not over). */
export const isLive = (call: CallInfo | null | undefined): call is CallInfo => !!call && call.state !== 'ENDED';

/** What the banner / overlay tell the person when a call ends without them being in it. */
export function endedMessage(call: CallInfo): string {
  switch (call.endReason) {
    case 'DECLINED':
      return 'Call declined.';
    case 'NO_ANSWER':
      return 'No answer.';
    case 'CANCELED':
      return 'Call canceled.';
    case 'BANNED':
      return 'The call was ended.';
    default:
      return 'Call ended.';
  }
}
