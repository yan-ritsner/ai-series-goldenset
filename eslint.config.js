import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default [
  // Ignore build + generated dirs
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".goldenset/**",
      "datasets/**",
      "eslint.config.js" // Exclude config file from type checking
    ],
  },

  // Base JS rules
  js.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.recommendedTypeChecked,

  // Your project config
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: new URL(".", import.meta.url).pathname,
      },
    },

    rules: {
      // Practical rules for CLI/tools
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" }
      ],

      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" }
      ],

      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/require-await": "off",

      // We intentionally allow console in CLI tools
      "no-console": "off",
    },
  },

  // Disable stylistic conflicts
  prettier,
];
