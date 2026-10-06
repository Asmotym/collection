// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { createI18n } from 'vue-i18n';
import UserCollection from './UserCollection.view.vue';
import UserSettings from './UserSettings.view.vue';
import en from '../../modules/language-switcher/locales/en.json';

const mocks = vi.hoisted(() => ({ getCollection: vi.fn(), getSettings: vi.fn(), updateSettings: vi.fn(), service: {} as any }));
vi.mock('api/api', () => ({ api: { user: mocks } }));
vi.mock('modules/discord-auth/services/discord.service', () => ({ DiscordService: { getInstance: () => mocks.service } }));
const account = () => ({ id: 'owner', username: 'Discord Name', originalUsername: 'Discord Name', customUsername: null, collectionShared: false, preferences: { cardSize: 'large' } });
const global = () => ({ plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })],
    stubs: {
        VContainer: { template: '<div><slot /></div>' }, VAlert: { template: '<div><slot /></div>' },
        VBtn: { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' },
        VTextField: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />' },
        VSwitch: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />' },
    },
});
beforeEach(() => {
    vi.clearAllMocks();
    mocks.service = { user: ref(null), handleLogin: vi.fn(async () => null), login: vi.fn(), storeUser: vi.fn(user => { mocks.service.user.value = user; }) };
});

describe('user collection routes', () => {
    it('loads anonymous public pages and discards stale responses when the owner changes', async () => {
        let finishFirst!: (value: unknown) => void;
        mocks.getCollection.mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }))
            .mockResolvedValueOnce({ owner: { id: 'second', username: 'Second' }, collection: [{ id: 2 }], categories: [] });
        const wrapper = shallowMount(UserCollection, { props: { userId: 'first' }, global: global() });
        await flushPromises();
        await wrapper.setProps({ userId: 'second' }); await flushPromises();
        finishFirst({ owner: { id: 'first', username: 'First' }, collection: [{ id: 1 }], categories: [] });
        await flushPromises();
        const browser = wrapper.findComponent({ name: 'CollectionBrowser' });
        expect(browser.props('title')).toBe('Second’s collection');
        expect(browser.props('collection')).toEqual([{ id: 2 }]);
        wrapper.unmount();
    });
    it('clears previously visible collection data when the next page is private', async () => {
        mocks.getCollection.mockResolvedValueOnce({ owner: { id: 'first', username: 'First' }, collection: [{ id: 1 }], categories: [] })
            .mockRejectedValueOnce(new Error('Collection unavailable'));
        const wrapper = shallowMount(UserCollection, { props: { userId: 'first' }, global: global() });
        await flushPromises(); await wrapper.setProps({ userId: 'private' }); await flushPromises();
        const browser = wrapper.findComponent({ name: 'CollectionBrowser' });
        expect(browser.props('collection')).toEqual([]);
        expect(browser.props('error')).toBe('Collection unavailable');
        wrapper.unmount();
    });
});

describe('owner settings', () => {
    it('shows sign-in and denies other users without fetching settings', async () => {
        const wrapper = shallowMount(UserSettings, { props: { userId: 'owner' }, global: global() });
        await flushPromises(); expect(wrapper.text()).toContain('Sign in to access');
        mocks.service.user.value = { ...account(), id: 'visitor' }; await flushPromises();
        expect(wrapper.text()).toContain('only access your own settings');
        expect(mocks.getSettings).not.toHaveBeenCalled();
        wrapper.unmount();
    });
    it('saves, cancels and resets names; keeps sharing unchanged when saving fails', async () => {
        mocks.service.user.value = account(); mocks.getSettings.mockResolvedValue(account());
        mocks.updateSettings.mockImplementation(async (_id, update) => ({ ...account(), ...update, username: update.customUsername ?? 'Discord Name' }));
        const wrapper = shallowMount(UserSettings, { props: { userId: 'owner' }, global: global() });
        await flushPromises();
        const edit = () => wrapper.get('[aria-label="Edit username"]').trigger('click');
        await edit(); await wrapper.get('input:not([type="checkbox"])').setValue('  Custom  ');
        await wrapper.get('form').trigger('submit'); await flushPromises();
        expect(mocks.updateSettings).toHaveBeenLastCalledWith('owner', { customUsername: 'Custom' });
        expect(wrapper.get('h2').text()).toBe('Custom');
        await edit(); await wrapper.get('input:not([type="checkbox"])').setValue('Discard');
        await wrapper.findAll('button').find(button => button.text() === 'Cancel')!.trigger('click');
        expect(wrapper.get('h2').text()).toBe('Custom');
        await edit(); await wrapper.get('input:not([type="checkbox"])').setValue('  ');
        await wrapper.get('form').trigger('submit'); await flushPromises();
        expect(mocks.updateSettings).toHaveBeenLastCalledWith('owner', { customUsername: null });
        expect(wrapper.get('h2').text()).toBe('Discord Name');
        mocks.updateSettings.mockRejectedValueOnce(new Error('Offline'));
        await wrapper.get('input[type="checkbox"]').setValue(true); await flushPromises();
        expect(wrapper.text()).toContain('Unable to save');
        expect(mocks.service.user.value.collectionShared).toBe(false);
        wrapper.unmount();
    });
});
