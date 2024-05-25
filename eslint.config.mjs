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
        'comma-dangle': 'off',
        "semi": [1, "always"],
        "no-new": 0,
        "indent": ["error", 4, { "SwitchCase": 1 }],
        'prefer-const': ['error', { 'ignoreReadBeforeAssign': true }],
        "space-before-function-paren": [
            2,
            "never"
        ],
        "brace-style": [
            2,
            "1tbs",
            { "allowSingleLine": true }
        ],
        'array-callback-return': "error",
        'no-console': "error",
        'no-else-return': "error",
        'no-extra-bind': "error",
        'no-extra-label': "error",
        'object-shorthand': "error",
        'sort-imports': "error"
    }
},
  {languageOptions: { globals: globals.browser }},
  pluginJs.configs.recommended,
];
