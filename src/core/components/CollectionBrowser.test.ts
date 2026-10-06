// @vitest-environment jsdom
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { createVuetify } from 'vuetify';
import { createI18n } from 'vue-i18n';
import Browser from './CollectionBrowser.component.vue';
import en from '../../modules/language-switcher/locales/en.json';
const mocks = vi.hoisted(() => ({ service: {} as any }));
vi.mock('modules/discord-auth/services/discord.service', () => ({ DiscordService: { getInstance: () => mocks.service } }));
beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} });
});
beforeEach(() => {
    localStorage.clear();
    mocks.service = { user: ref(null), updatePreferences: vi.fn() };
});
function mountBrowser() {
    return shallowMount(Browser, { props: {
        title: 'Public collection', collectionLoading: false,
        collection: [
            { id: 1, artist_name: 'First', album_name: 'One', album_year: 2001, category_ids: [2] },
            { id: 2, artist_name: 'Second', album_name: 'Two', album_year: 2002, category_ids: [] },
        ] as any,
        categories: [
            { id: 1, name: 'Parent', parent_id: null, position: 0 },
            { id: 2, name: 'Child', parent_id: 1, position: 0 },
        ] as any,
    }, global: {
        plugins: [createVuetify(), createI18n({ legacy: false, locale: 'en', messages: { en } })],
        renderStubDefaultSlot: true,
        stubs: { VNavigationDrawer: true, VBtn: true, VDivider: true, VList: true, VListItem: true,
            VContainer: true, VTextField: true, VBtnToggle: true, VRow: true, VCol: true, VAlert: true, VEmptyState: true },
    } });
}
it('offers category descendants, filters and details to anonymous visitors', async () => {
    const wrapper = mountBrowser();
    const cards = () => wrapper.findAllComponents({ name: 'CollectionCard' });
    expect(cards()).toHaveLength(2);
    wrapper.findComponent({ name: 'CategoryNavigationList' }).vm.$emit('select', 1);
    await flushPromises(); expect(cards()).toHaveLength(1);
    cards()[0]!.vm.$emit('open'); await flushPromises();
    expect(wrapper.findComponent({ name: 'CollectionDetailsDialog' }).props('item').id).toBe(1);
    wrapper.findComponent({ name: 'CollectionFilters' }).vm.$emit('update:year', [1999]);
    await flushPromises(); expect(cards()).toHaveLength(0);
    wrapper.findComponent({ name: 'CollectionFilters' }).vm.$emit('clear');
    await flushPromises(); expect(cards()).toHaveLength(1);
    wrapper.unmount();
});
it('stores guest card size locally and uses the viewer preferences when signed in', async () => {
    const wrapper = mountBrowser();
    wrapper.findComponent({ name: 'VBtnToggle' }).vm.$emit('update:modelValue', 'small');
    await flushPromises();
    expect(localStorage.getItem('collection_card_size')).toBe('small');
    expect(mocks.service.updatePreferences).not.toHaveBeenCalled();
    mocks.service.user.value = { id: 'viewer', preferences: { cardSize: 'medium' } };
    await flushPromises();
    expect(wrapper.findComponent({ name: 'VBtnToggle' }).attributes('modelvalue')).toBe('medium');
    wrapper.findComponent({ name: 'VBtnToggle' }).vm.$emit('update:modelValue', 'large');
    await flushPromises(); expect(mocks.service.updatePreferences).toHaveBeenCalledWith({ cardSize: 'large' });
    wrapper.unmount();
});
