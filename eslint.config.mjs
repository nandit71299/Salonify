import globals from "globals";
import pluginJs from "@eslint/js";


export default [
  {
    files: ["**/*.js"],
    languageOptions: {sourceType: "commonjs"},
    rules: {
        'no-unused-vars': 'error',
        'no-undef': 'error',
        'dot-notation': 'error',
        'func-name-matching': 'error',
        'yoda': 'error',
        'arrow-body-style': ['error', 'always'],
        'strict': ['error', 'global'],
        'eqeqeq': ['error', 'always'],
        'quotes': ['error', 'single'],
        'prefer-const': ['error', { 'ignoreReadBeforeAssign': true }],
    }
},
  {languageOptions: { globals: globals.browser }},
  pluginJs.configs.recommended,
];
