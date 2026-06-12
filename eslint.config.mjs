import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["**/dist/**", "**/coverage/**", "**/node_modules/**", "**/.commandcode/**", "**/.venv/**", "**/venv/**"]
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off"
    }
  },
  {
    files: ["**/*.mjs", "**/*.cjs"],
    languageOptions: { 
      globals: { 
        process: "readonly", 
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Buffer: "readonly",
        global: "readonly"
      } 
    }
  }
);
