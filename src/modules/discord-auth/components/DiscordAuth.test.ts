// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { createI18n } from 'vue-i18n';
import DiscordAuth from './DiscordAuth.vue';
import en from '../../language-switcher/locales/en.json';
const mocks = vi.hoisted(() => ({ service: {} as any }));
vi.mock('modules/discord-auth/services/discord.service', () => ({ DiscordService: { getInstance: () => mocks.service } }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
it('puts My Page and Settings below the reactive name, before Disconnect', async () => {
    mocks.service = { user: ref({ id: '123', username: 'Original', avatar: '' }), handleLogin: vi.fn() };
    const wrapper = shallowMount(DiscordAuth, { global: {
        plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })], renderStubDefaultSlot: true,
        stubs: { VContainer: true, VRow: true, VMenu: true, VCard: true, VCardText: true, VAvatar: true, VImg: true, VDivider: true,
            VBtn: { name: 'ButtonStub', props: ['to'], template: '<button><slot /></button>' } },
    } });
    await flushPromises();
    const buttons = wrapper.findAll('button');
    expect(buttons.map(button => button.text())).toEqual(['My Page', 'Settings', 'Logout']);
    const components = wrapper.findAllComponents({ name: 'ButtonStub' });
    expect(components[0]!.props('to')).toEqual({ name: 'UserCollection', params: { userId: '123' } });
    expect(components[1]!.props('to')).toEqual({ name: 'UserSettings', params: { userId: '123' } });
    expect(wrapper.html().indexOf('<h3>Original</h3>')).toBeLessThan(wrapper.html().indexOf('My Page'));
    mocks.service.user.value.username = 'Custom'; await flushPromises();
    expect(wrapper.get('h3').text()).toBe('Custom');
    wrapper.unmount();
});
