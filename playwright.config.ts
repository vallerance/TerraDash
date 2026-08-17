import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './browser',
  reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/TerraDash/',
    reuseExistingServer: false,
  },
});
