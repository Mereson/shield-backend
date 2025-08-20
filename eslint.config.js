import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"

export default tseslint.config(
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		ignores: ["dist/**"],
	},
	{
		languageOptions: {
			globals: {
				...globals.node,
			},
			parserOptions: {
				project: "./tsconfig.json",
			},
		},
		rules: {
			"@typescript-eslint/no-explicit-any": "warn",
			"@typescript-eslint/explicit-function-return-type": "warn",
		},
	}
)
