// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import { createVuetify } from 'vuetify';
import { VTextField } from 'vuetify/components/VTextField';
import { createI18n } from 'vue-i18n';
import Home from './Home.layout.vue';
import en from '../../modules/language-switcher/locales/en.json';

vi.mock('modules/discord-auth/services/discord.service', () => ({
    DiscordService: { getInstance: () => ({
        user: ref({ id: 'user', preferences: { cardSize: 'medium' } }),
        handleLogin: async () => ({ id: 'user', preferences: { cardSize: 'medium' } }),
        updatePreferences: vi.fn(),
    }) },
}));
vi.mock('core/store/index.store', () => ({ store: {
    collection: () => ({ getAll: async () => [
        { id: 1, artist_name: 'Radiohead', album_name: 'OK Computer', album_year: 1997, category_ids: [] },
        { id: 2, artist_name: 'Portishead', album_name: 'Dummy', album_year: 1994, category_ids: [] },
    ] }),
    category: () => ({ getAll: async () => [] }),
} }));

beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} });
});

describe('home collection search', () => {
    it('filters visible cards by artist, album and year, and restores them when cleared', async () => {
        const wrapper = mount(Home, {
            global: {
                plugins: [createVuetify({ components: { VTextField } }), createI18n({ legacy: false, locale: 'en', messages: { en } })],
                stubs: {
                    HeaderComponent: true, CollectionFilters: true, CollectionDetailsDialog: true,
                    SignedOutLanding: true, CategoryNavigationList: true, AppSkeleton: true,
                    CollectionCard: defineComponent({ props: ['item'], template: '<div data-test="card">{{ item.album_name }}</div>' }),
                    VContainer: { template: '<div><slot /></div>' },
                    VRow: { template: '<div><slot /></div>' },
                    VCol: { template: '<div><slot /></div>' },
                    VBtnToggle: { template: '<div><slot /></div>' },
                    VBadge: { template: '<div><slot /></div>' },
                    VBtn: true, VEmptyState: true, VList: true, VListItem: true, VDivider: true, VNavigationDrawer: true,
                },
            },
        });
        await flushPromises();
        const cards = () => wrapper.findAll('[data-test="card"]').map(card => card.text());
        expect(cards()).toEqual(['OK Computer', 'Dummy']);
        const input = wrapper.get('input');
        for (const query of ['radiohead', 'OK Computer', '1997']) {
            await input.setValue(query);
            expect(cards()).toEqual(['OK Computer']);
        }
        await input.setValue('missing');
        expect(cards()).toEqual([]);
        await wrapper.get('.v-field__clearable [role="button"]').trigger('click');
        await flushPromises();
        expect(cards()).toEqual(['OK Computer', 'Dummy']);
        wrapper.unmount();
    });
});
