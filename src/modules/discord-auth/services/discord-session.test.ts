// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { ensureDiscordAuth, InvalidDiscordSession } from './discord-session';
import { ApiClient } from '../../../api/client.api';
const old = { accessToken: 'old', refreshToken: 'refresh', tokenType: 'Bearer', expiresAt: 1 };
const updated = { ...old, accessToken: 'new', refreshToken: 'rotated', expiresAt: Date.now() + 3600000 };
const response = (status: number, data: unknown) => ({ status, ok: status < 400, json: async () => data });
beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());
it('shares refresh and persists both rotated tokens before concurrent requests', async () => {
    localStorage.setItem('discord_auth', JSON.stringify(old));
    const fetch = vi.fn(async () => response(200, { success: true, data: updated }));
    vi.stubGlobal('fetch', fetch);
    const result = await Promise.all([ensureDiscordAuth(), ensureDiscordAuth()]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual([updated, updated]);
    expect(JSON.parse(localStorage.getItem('discord_auth')!)).toEqual(updated);
});
it('does not restore tokens after logout during refresh', async () => {
    localStorage.setItem('discord_auth', JSON.stringify(old));
    let finish!: (value: unknown) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { finish = resolve; })));
    const pending = ensureDiscordAuth();
    localStorage.clear();
    finish(response(200, { success: true, data: updated }));
    expect(await pending).toBeNull();
    expect(localStorage.getItem('discord_auth')).toBeNull();
});
it('preserves credentials on temporary refresh failure but clears invalid grants', async () => {
    localStorage.setItem('discord_auth', JSON.stringify(old));
    vi.stubGlobal('fetch', vi.fn(async () => response(502, { error: 'Unavailable' })));
    await expect(ensureDiscordAuth()).rejects.toThrow('Unavailable');
    expect(localStorage.getItem('discord_auth')).not.toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => response(401, {})));
    await expect(ensureDiscordAuth()).rejects.toBeInstanceOf(InvalidDiscordSession);
    expect(localStorage.getItem('discord_auth')).toBeNull();
});
it('refreshes and retries an API 401 once with the new token', async () => {
    localStorage.setItem('discord_auth', JSON.stringify({ ...old, expiresAt: Date.now() + 3600000 }));
    const fetch = vi.fn().mockResolvedValueOnce(response(401, {}))
        .mockResolvedValueOnce(response(200, { success: true, data: updated }))
        .mockResolvedValueOnce(response(200, { success: true, data: 'saved' }));
    vi.stubGlobal('fetch', fetch);
    expect(await ApiClient.request('/users/owner/settings')).toBe('saved');
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[2][1].headers.get('Authorization')).toBe('Bearer new');
});
