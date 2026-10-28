import { GROUP_MAX_MEMBERS, GROUP_MIN_MEMBERS } from '@/src/constants';

/** The part of a person the group rules look at. */
interface Candidate {
  id: string;
  role: 'MEMBER' | 'COACH';
}

/** An existing group, when people are being ADDED to it (not created): who is in it and whether it has a coach. */
export interface ExistingGroup {
  memberIds: string[];
  memberCount: number;
  /** A coach is already in it (the creator counts). */
  hasCoach: boolean;
}

/**
 * Why this person cannot be added right now (shown on their row), or null when they can.
 * The same rules the server enforces, applied here so nobody can even tap a choice that would be refused:
 *  - a group has 6 people at most, and I am one of them
 *  - ONE coach at most: if I am a coach, or a coach is already chosen, no other coach
 * Somebody who is already chosen can always be removed.
 * With `group` (adding to an existing group) the room left is what is free beyond the people already in it.
 */
export function whyCannotAdd(person: Candidate, chosen: Candidate[], iAmCoach: boolean, group?: ExistingGroup): string | null {
  if (chosen.some((c) => c.id === person.id)) return null;
  if (group?.memberIds.includes(person.id)) return 'Already in the group';
  const room = GROUP_MAX_MEMBERS - (group ? group.memberCount : 1); // without a group, only I am in it
  if (chosen.length >= room) return `A group has at most ${GROUP_MAX_MEMBERS} people`;
  if (person.role === 'COACH') {
    if (group?.hasCoach) return 'This group already has a coach';
    if (iAmCoach) return 'You are the coach of this group';
    if (chosen.some((c) => c.role === 'COACH')) return 'Only one coach per group';
  }
  return null;
}

/** Add the person, or take them out if they are already chosen. A choice the rules refuse changes nothing. */
export function toggleChoice<T extends Candidate>(chosen: T[], person: T, iAmCoach: boolean, group?: ExistingGroup): T[] {
  if (chosen.some((c) => c.id === person.id)) return chosen.filter((c) => c.id !== person.id);
  return whyCannotAdd(person, chosen, iAmCoach, group) ? chosen : [...chosen, person];
}

/** A name and at least two other people (3 in total with me). */
export const canCreateGroup = (title: string, chosen: Candidate[]): boolean => title.trim().length > 0 && chosen.length >= GROUP_MIN_MEMBERS - 1;
