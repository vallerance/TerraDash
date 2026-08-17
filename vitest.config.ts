import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: [...configDefaults.exclude, 'browser/**'],
  },
});
