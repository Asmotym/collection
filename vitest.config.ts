import { defineConfig } from 'vitest/config';
import path from 'node:path';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    plugins: [vue()],
    test: {
        include: ['src/**/*.test.ts'],
        server: { deps: { inline: ['vuetify'] } },
    },
    resolve: {
        alias: {
            core: path.resolve(__dirname, 'src/core'),
            modules: path.resolve(__dirname, 'src/modules'),
            assets: path.resolve(__dirname, 'src/assets'),
            api: path.resolve(__dirname, 'src/api'),
        },
    },
});
