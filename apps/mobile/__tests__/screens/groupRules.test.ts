import { canCreateGroup, toggleChoice, whyCannotAdd } from '@/src/screens/home/newGroup/groupRules';

const member = (id: string) => ({ id, role: 'MEMBER' as const });
const coach = (id: string) => ({ id, role: 'COACH' as const });

describe('whyCannotAdd: who can be added to a group', () => {
  it('a member can always be added while there is room', () => {
    expect(whyCannotAdd(member('m1'), [], false)).toBeNull();
    expect(whyCannotAdd(member('m5'), [member('m1'), member('m2'), member('m3'), member('m4')], false)).toBeNull();
  });

  it('a coach can be added when there is no coach yet', () => {
    expect(whyCannotAdd(coach('c1'), [member('m1')], false)).toBeNull();
  });

  it('ONE coach only: a second coach is refused, with the reason', () => {
    expect(whyCannotAdd(coach('c2'), [coach('c1'), member('m1')], false)).toBe('Only one coach per group');
  });

  it('when I am the coach, I am the group\'s coach: no other coach can be added', () => {
    expect(whyCannotAdd(coach('c1'), [], true)).toBe('You are the coach of this group');
    expect(whyCannotAdd(member('m1'), [], true)).toBeNull(); // members are fine
  });

  it('6 people at most including me: with 5 chosen the group is full', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map(member);
    expect(whyCannotAdd(member('f'), five, false)).toBe('A group has at most 6 people');
    expect(whyCannotAdd(coach('c1'), five, false)).toBe('A group has at most 6 people');
  });

  it('someone already chosen can always be taken out again, even in a full group or with two coaches around', () => {
    const five = [coach('c1'), member('b'), member('c'), member('d'), member('e')];
    expect(whyCannotAdd(coach('c1'), five, false)).toBeNull();
    expect(whyCannotAdd(member('b'), five, false)).toBeNull();
  });
});

describe('toggleChoice', () => {
  it('adds a person, and removes them on the second tap', () => {
    const one = toggleChoice([], member('m1'), false);
    expect(one.map((p) => p.id)).toEqual(['m1']);
    expect(toggleChoice(one, member('m1'), false)).toEqual([]);
  });

  it('a refused choice changes nothing (and returns the same list)', () => {
    const chosen = [coach('c1')];
    expect(toggleChoice(chosen, coach('c2'), false)).toBe(chosen);
  });

  it('after the coach is removed another coach can be chosen', () => {
    let chosen = toggleChoice([], coach('c1'), false);
    chosen = toggleChoice(chosen, coach('c1'), false);
    expect(toggleChoice(chosen, coach('c2'), false).map((p) => p.id)).toEqual(['c2']);
  });

  it('never changes the list it was given', () => {
    const chosen = [member('m1')];
    toggleChoice(chosen, member('m2'), false);
    expect(chosen).toHaveLength(1);
  });
});

describe('canCreateGroup', () => {
  it('needs a name and at least two other people', () => {
    expect(canCreateGroup('Team', [member('a'), member('b')])).toBe(true);
    expect(canCreateGroup('Team', [member('a')])).toBe(false);
    expect(canCreateGroup('   ', [member('a'), member('b')])).toBe(false);
    expect(canCreateGroup('', [])).toBe(false);
  });
});

describe('adding to an existing group (4 people in it, one of them the creator)', () => {
  const group = { memberIds: ['me', 'a', 'b', 'c'], memberCount: 4, hasCoach: false };

  it('people already in it are refused with the reason', () => {
    expect(whyCannotAdd(member('a'), [], false, group)).toBe('Already in the group');
  });

  it('room is what is left of 6: with 4 in, two more can be chosen and a third is refused', () => {
    expect(whyCannotAdd(member('x'), [], false, group)).toBeNull();
    expect(whyCannotAdd(member('y'), [member('x')], false, group)).toBeNull();
    expect(whyCannotAdd(member('z'), [member('x'), member('y')], false, group)).toBe('A group has at most 6 people');
  });

  it('a group that already has a coach takes no other coach, but a group without one can get one', () => {
    expect(whyCannotAdd(coach('c9'), [], false, { ...group, hasCoach: true })).toBe('This group already has a coach');
    expect(whyCannotAdd(coach('c9'), [], false, group)).toBeNull();
    expect(whyCannotAdd(coach('c8'), [coach('c9')], false, group)).toBe('Only one coach per group');
  });

  it('toggleChoice follows the same rules', () => {
    expect(toggleChoice([], member('a'), false, group)).toEqual([]); // already in
    expect(toggleChoice([], member('x'), false, group).map((p) => p.id)).toEqual(['x']);
  });
});
