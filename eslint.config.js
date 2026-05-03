import globals from "globals";

export default [
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.node
      }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      "semi": ["error", "always"],
      "quotes": ["error", "single", { avoidEscape: true }]
    }
  },
  {
    ignores: ["node_modules/", "test/", "data/", "coverage/"]
  }
];