import type { Config } from "tailwindcss";
import uiCorePreset from "../../packages/ui-core/tailwind.preset.cjs";

export default {
  darkMode: ["class"],
  presets: [uiCorePreset],
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
    "../../packages/ui-core/src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
