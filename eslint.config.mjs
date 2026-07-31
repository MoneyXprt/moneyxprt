import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Cosmetic-only rule (literal apostrophes/quotes in JSX text) — not a
      // code-correctness issue. Downgraded so it doesn't block production
      // builds; still surfaces as a warning locally.
      "react/no-unescaped-entities": "warn",
    },
  },
];

export default eslintConfig;
