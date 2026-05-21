import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.node }, rules: {
      "prefer-const": "warn",
      "no-constant-binary-expression": "error",
    },
  },
  { files: ["**/*.js"], languageOptions: { sourceType: "module" } },
  {
    // Thêm dòng này để bỏ qua các thư mục không muốn quét
    ignores: ["node_modules/", "dist/", "public/", "app/generated/"]
  },
]);
