import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist/**", "coverage/**", "node_modules/**"] },
  {
    files: ["src/**/*.{js,jsx}", "scripts/**/*.mjs", "tests/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "no-undef": "error",
      "no-unreachable": "error",
      "no-dupe-keys": "error",
      "no-constant-binary-expression": "error",
      "react-hooks/rules-of-hooks": "error",
    },
  },
];
