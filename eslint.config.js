// Flat config. The code is plain ES5-ish browser scripts sharing globals on window.
const globals = require('globals');

// Each js file hangs its public object on window; the rest are loaded in index.html order.
const projectGlobals = [
  'U', 'WM', 'Shell', 'FS', 'Sound', 'Icons', 'Boot', 'Web', 'Dialogs', 'Achievements',
  'Themes', 'Cards', 'Menu', 'FileClip', 'TaskMan', 'BSOD', 'Y2K', 'AOLData', 'WordPadSanitize', 'Screensaver'
].reduce((o, n) => { o[n] = 'writable'; return o; }, {});

module.exports = [
  { ignores: ['apps/doom/**', 'node_modules/**', 'tests/**', 'test-results/**', 'playwright-report/**', '_site/**'] },
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2017,
      sourceType: 'script',
      globals: Object.assign({}, globals.browser, projectGlobals)
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none' }],
      'no-redeclare': 'error',
      'no-restricted-syntax': ['warn', {
        selector: "AssignmentExpression[left.property.name='innerHTML']",
        message: 'Assigning innerHTML: make sure the string is trusted or sanitized.'
      }]
    }
  },
  // Config and tests run in node.
  { files: ['*.js', 'tests/**/*.js'], languageOptions: { sourceType: 'commonjs', ecmaVersion: 2022, globals: globals.node } }
];
