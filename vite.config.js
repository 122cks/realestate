import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages에 /realestate/ 경로로 배포할 경우 base를 설정해야 합니다.
export default defineConfig({
  base: '/realestate/',
  plugins: [react()],
});
