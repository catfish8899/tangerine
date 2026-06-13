/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // 确保这一行存在，它会深度递归扫描 src 下所有组件！
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
