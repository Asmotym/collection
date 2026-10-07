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
            VContainer: true, VTextField: true, VSelect: true, VBtnToggle: true, VRow: true, VCol: true, VAlert: true, VEmptyState: true },
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

it('offers a sort selector and reorders the displayed cards', async () => {
    const wrapper = mountBrowser();
    const selector = wrapper.findComponent({ name: 'VSelect' });
    expect(selector.attributes('label')).toBe('Sort by');
    selector.vm.$emit('update:modelValue', 'alphabetic-desc');
    await flushPromises();
    expect(wrapper.findAllComponents({ name: 'CollectionCard' }).map((card) => card.props('item').id))
        .toEqual([2, 1]);
    wrapper.unmount();
});

it('restores and saves guest sorting across visits, ignoring invalid stored values', async () => {
    localStorage.setItem('collection_sort_by', 'invalid');
    let wrapper = mountBrowser();
    expect(wrapper.findComponent({ name: 'VSelect' }).attributes('modelvalue')).toBe('added-asc');
    wrapper.findComponent({ name: 'VSelect' }).vm.$emit('update:modelValue', 'alphabetic-desc');
    await flushPromises();
    expect(localStorage.getItem('collection_sort_by')).toBe('alphabetic-desc');
    expect(mocks.service.updatePreferences).not.toHaveBeenCalled();
    wrapper.unmount();
    wrapper = mountBrowser();
    expect(wrapper.findComponent({ name: 'VSelect' }).attributes('modelvalue')).toBe('alphabetic-desc');
    wrapper.unmount();
});

it('uses viewer sorting and saves only sort changes without overwriting card size', async () => {
    localStorage.setItem('collection_sort_by', 'alphabetic-desc');
    mocks.service.user.value = { id: 'viewer', preferences: { cardSize: 'medium', sortBy: 'edited-desc' } };
    const wrapper = mountBrowser();
    const selector = wrapper.findComponent({ name: 'VSelect' });
    expect(selector.attributes('modelvalue')).toBe('edited-desc');
    expect(mocks.service.updatePreferences).not.toHaveBeenCalled();
    selector.vm.$emit('update:modelValue', 'releaseDate-asc');
    await flushPromises();
    expect(mocks.service.updatePreferences).toHaveBeenCalledExactlyOnceWith({ sortBy: 'releaseDate-asc' });
    expect(localStorage.getItem('collection_sort_by')).toBe('alphabetic-desc');
    mocks.service.user.value = null;
    await flushPromises();
    expect(selector.attributes('modelvalue')).toBe('alphabetic-desc');
    wrapper.unmount();
});
