import { callTitle, connectedCount, endedMessage, formatDuration, isLive, participantLabel } from '@/src/service/call/callUi';
import { callInfo } from '../../test-utils/chat';

describe('call helpers', () => {
  it('formatDuration: minutes and seconds, hours only when needed', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9_000)).toBe('0:09');
    expect(formatDuration(75_000)).toBe('1:15');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
    expect(formatDuration(-5000)).toBe('0:00'); // a clock that is a little behind never shows a minus
  });

  it('each person has a plain-words state', () => {
    const p = (status: 'JOINED' | 'INVITED' | 'DECLINED' | 'MISSED' | 'BUSY', leftAt: string | null = null) => ({ userId: 'u', name: 'U', status, joinedAt: status === 'JOINED' ? 'x' : null, leftAt });
    expect(participantLabel(p('JOINED'))).toBe('In call');
    expect(participantLabel(p('JOINED', 'later'))).toBe('Left');
    expect(participantLabel(p('INVITED'))).toBe('Ringing…');
    expect(participantLabel(p('DECLINED'))).toBe('Declined');
    expect(participantLabel(p('MISSED'))).toBe('Missed');
    expect(participantLabel(p('BUSY'))).toBe('On another call');
  });

  it('a direct call is titled with the other person, a group call "Group call"', () => {
    expect(callTitle(callInfo(), 'ann')).toBe('Ben');
    expect(callTitle(callInfo(), 'ben')).toBe('Ann');
    const group = callInfo({ participants: [...callInfo().participants, { userId: 'cara', name: 'Cara', status: 'INVITED', joinedAt: null, leftAt: null }] });
    expect(callTitle(group, 'ann')).toBe('Group call');
  });

  it('counts who is connected right now (joined and not left)', () => {
    expect(connectedCount(callInfo())).toBe(1);
    const both = callInfo({ participants: callInfo().participants.map((p) => ({ ...p, status: 'JOINED' as const, joinedAt: 'x' })) });
    expect(connectedCount(both)).toBe(2);
    expect(connectedCount({ ...both, participants: both.participants.map((p) => ({ ...p, leftAt: 'y' })) })).toBe(0);
  });

  it('isLive and the "it ended" sentences', () => {
    expect(isLive(callInfo())).toBe(true);
    expect(isLive(callInfo({ state: 'ENDED', endReason: 'COMPLETED' }))).toBe(false);
    expect(isLive(null)).toBe(false);
    expect(endedMessage(callInfo({ endReason: 'DECLINED' }))).toBe('Call declined.');
    expect(endedMessage(callInfo({ endReason: 'NO_ANSWER' }))).toBe('No answer.');
    expect(endedMessage(callInfo({ endReason: 'CANCELED' }))).toBe('Call canceled.');
    expect(endedMessage(callInfo({ endReason: 'COMPLETED' }))).toBe('Call ended.');
  });
});
