import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

const eslintConfig = [
  {
    ignores: ['.next/**', 'next-env.d.ts', 'coverage/**'],
  },
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      // Next 16 enables React Compiler diagnostics by default. The app has existing
      // async loading and hydration effects that need a dedicated refactor before
      // compiler adoption; keep the established lint rules active in the meantime.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      // Cosmetic-only rule (literal apostrophes/quotes in JSX text) — not a
      // code-correctness issue. Downgraded so it doesn't block production
      // builds; still surfaces as a warning locally.
      "react/no-unescaped-entities": "warn",
    },
  },
];

export default eslintConfig;
