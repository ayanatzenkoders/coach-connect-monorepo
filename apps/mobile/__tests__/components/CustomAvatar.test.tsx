import { initialsOf } from '@/src/components/common/CustomAvatar';

describe('initialsOf', () => {
  it('takes the first letter of the first two words, in capitals', () => {
    expect(initialsOf('amara okafor')).toBe('AO');
    expect(initialsOf('Marcus Bell Junior')).toBe('MB');
    expect(initialsOf('  Lena   Fischer ')).toBe('LF');
  });

  it('works for one word', () => {
    expect(initialsOf('Cher')).toBe('C');
  });

  it('never cuts an emoji in half: symbols and emoji words are skipped', () => {
    expect(initialsOf('Zoë 🌟 Åström')).toBe('ZÅ');
    expect(initialsOf('🌟 Star')).toBe('S');
  });

  it('keeps non-Latin scripts', () => {
    expect(initialsOf('日本 語')).toBe('日語');
    expect(initialsOf('محمد علي')).toBe('مع');
  });

  it('falls back to "?" when there is no letter at all', () => {
    expect(initialsOf('🌟🎉')).toBe('?');
    expect(initialsOf('   ')).toBe('?');
  });
});
