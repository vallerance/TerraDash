import { defineConfig } from '@playwright/test';

const liveBaseUrl = process.env.LIVE_BASE_URL;

export default defineConfig({
  testDir: './browser',
  reporter: 'line',
  use: { baseURL: liveBaseUrl ?? 'http://127.0.0.1:4173' },
  webServer: liveBaseUrl
    ? undefined
    : {
        command: 'npm run preview -- --host 127.0.0.1',
        url: 'http://127.0.0.1:4173/TerraDash/',
        reuseExistingServer: false,
      },
});
