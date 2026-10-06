// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DiscordService } from './discord.service';
beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });
it('shares one authentication request and keeps the server custom name', async () => {
    localStorage.setItem('discord_auth', JSON.stringify({ accessToken: 'token', tokenType: 'Bearer' }));
    const user = { id: 'owner', username: 'Custom', originalUsername: 'Discord', customUsername: 'Custom', collectionShared: false };
    const fetch = vi.fn(async () => ({ json: async () => ({ success: true, data: user }) }));
    vi.stubGlobal('fetch', fetch);
    const service = new DiscordService();
    const [first, second] = await Promise.all([service.handleLogin(), service.handleLogin()]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(first?.username).toBe('Custom'); expect(second).toEqual(first);
    expect(service.user.value?.originalUsername).toBe('Discord');
});
it('does not treat a saved user as authenticated when the credential is invalid', async () => {
    localStorage.setItem('discord_auth', JSON.stringify({ accessToken: 'expired' }));
    localStorage.setItem('discord_user', JSON.stringify({ id: 'owner' }));
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ success: false }) })));
    const service = new DiscordService();
    expect(await service.handleLogin()).toBeNull();
    expect(localStorage.getItem('discord_auth')).toBeNull();
    expect(localStorage.getItem('discord_user')).toBeNull();
});
it('does not restore authentication from a request that completes after logout', async () => {
    localStorage.setItem('discord_auth', JSON.stringify({ accessToken: 'token' }));
    let finish!: (value: unknown) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { finish = resolve; })));
    const service = new DiscordService();
    const pending = service.handleLogin(); service.logout();
    finish({ json: async () => ({ success: true, data: { id: 'owner', username: 'Owner' } }) });
    await pending;
    expect(service.user.value).toBeNull();
    expect(localStorage.getItem('discord_user')).toBeNull();
});
