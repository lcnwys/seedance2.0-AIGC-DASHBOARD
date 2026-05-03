import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
	  globalIgnores([
	    // Default ignores of eslint-config-next:
	    ".next/**",
	    "out/**",
	    "build/**",
	    "next-env.d.ts",
	  ]),
	  {
	    rules: {
	      // The existing codebase still has broad API payload and admin UI shapes.
	      // Keep these visible without blocking unrelated lint signal.
	      "@typescript-eslint/no-explicit-any": "warn",
	      // These React Compiler rules are too noisy for the current codebase and
	      // flag established UI reset/mount patterns as build-blocking errors.
	      "react-hooks/set-state-in-effect": "off",
	      "react-hooks/preserve-manual-memoization": "off",
	    },
	  },
	]);

export default eslintConfig;
