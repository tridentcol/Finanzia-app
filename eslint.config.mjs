import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // Regla no negociable #9: sin `any`. Usa `unknown` + narrowing.
      "@typescript-eslint/no-explicit-any": "error",
      // Regla de organizacion #1: una responsabilidad por archivo, max 300
      // lineas de codigo. `warn` por ahora: hay archivos legados que superan
      // el limite (extraerlos es parte de la higiene continua, no de Fase 0).
      // schema.ts y catalog.ts son excepciones documentadas (catalogos).
      "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Regla de organizacion #6: toda env var se accede via src/lib/env.ts.
    // Prohibe `process.env` en el resto de src/ (el tooling CLI en scripts/ y
    // los config de la raiz quedan fuera de este scope a proposito).
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.name='process'][property.name='env']",
          message:
            "No accedas a process.env directamente. Importa `env` desde '@/lib/env'.",
        },
      ],
    },
  },
  {
    // env.ts es la unica frontera autorizada para leer process.env.
    files: ["src/lib/env.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "drizzle/**",
    "design_handoff_finanzia_brand/**",
  ]),
]);

export default eslintConfig;
