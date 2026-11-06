module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Colours come from the theme (`COLORS`, `AVATAR_TINTS` in src/constants/theme/colors.ts), never typed into a screen or component.
    'no-restricted-syntax': [
      'error',
      { selector: 'Literal[value=/^#[0-9A-Fa-f]{3,8}$/]', message: 'Use a colour token from COLORS (src/constants/theme/colors.ts) instead of a raw hex value.' },
      { selector: 'Literal[value=/^rgba?\\(/]', message: 'Use a colour token from COLORS (src/constants/theme/colors.ts) instead of a raw rgb()/rgba() value.' },
    ],
  },
  overrides: [{ files: ['src/constants/theme/colors.ts'], rules: { 'no-restricted-syntax': 'off' } }],
};
