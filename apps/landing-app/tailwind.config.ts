import type { Config } from "tailwindcss";
import uiCorePreset from "../../packages/ui-core/tailwind.preset.cjs";

export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui-core/src/**/*.{ts,tsx}",
  ],
  presets: [uiCorePreset as unknown as Config],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
