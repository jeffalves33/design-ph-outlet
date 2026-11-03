import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      ".audit/**",
      ".next/**",
      ".next-*/**",
      "node_modules/**",
      "dist/**",
      ".output/**",
      ".vinxi/**",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": "off",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/mock-data",
                "@/lib/store",
                "@tanstack/**",
              ],
              message: "Runtime Next não pode importar o protótipo ou dados simulados.",
            },
          ],
        },
      ],
    },
  },
);
