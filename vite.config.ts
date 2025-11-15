import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  // GitHub Pages serves the app from /xxx/, adjust the base path when building there.
  base: isGitHubActions ? '/xxx/' : '/',
  plugins: [react()],
});

