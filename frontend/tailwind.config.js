/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f4f6f8",
          100: "#e5e9ee",
          200: "#c7cfd9",
          300: "#9fabbb",
          400: "#71829a",
          500: "#54647d",
          600: "#414f65",
          700: "#354052",
          800: "#232a37",
          900: "#171b24",
        },
        signal: {
          50: "#eefbf5",
          100: "#d6f5e6",
          200: "#aeeacd",
          300: "#78d8ac",
          400: "#43bf87",
          500: "#22a06c",
          600: "#158056",
          700: "#116547",
          800: "#0f503a",
          900: "#0c4230",
        },
        amber: {
          50: "#fff8ec",
          100: "#ffedc7",
          200: "#ffd685",
          300: "#ffbc4d",
          400: "#fca024",
          500: "#f2810c",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "'Noto Sans Tamil'", "'Lohit Tamil'", "'Mukta Malar'", "'Tamil Sangam MN'", "'InaiMathi'", "'Latha'", "'Vijaya'", "'Noto Sans Devanagari'", "'Lohit Devanagari'", "'Mangal'", "'Nirmala UI'", "system-ui", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
        body: ["'Inter'", "'Noto Sans Tamil'", "'Lohit Tamil'", "'Mukta Malar'", "'Tamil Sangam MN'", "'InaiMathi'", "'Latha'", "'Vijaya'", "'Noto Sans Devanagari'", "'Lohit Devanagari'", "'Mangal'", "'Nirmala UI'", "system-ui", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
        sans: ["'Inter'", "'Noto Sans Tamil'", "'Lohit Tamil'", "'Mukta Malar'", "'Tamil Sangam MN'", "'InaiMathi'", "'Latha'", "'Vijaya'", "'Noto Sans Devanagari'", "'Lohit Devanagari'", "'Mangal'", "'Nirmala UI'", "system-ui", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
