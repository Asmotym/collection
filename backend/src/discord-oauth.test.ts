import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerDiscordOAuth } from './discord-oauth.js';

test('Discord OAuth exchanges codes and refresh tokens without exposing the secret', async (t) => {
    const originalFetch = globalThis.fetch;
    const env = { ...process.env };
    t.after(() => { globalThis.fetch = originalFetch; process.env = env; });
    process.env.DISCORD_CLIENT_ID = 'client';
    process.env.DISCORD_CLIENT_SECRET = 'secret';
    process.env.DISCORD_REDIRECT_URI = 'https://example.com';
    const app = Fastify(); registerDiscordOAuth(app); t.after(() => app.close());
    let submitted: URLSearchParams;
    globalThis.fetch = (async (_url, init) => {
        submitted = init!.body as URLSearchParams;
        return new Response(JSON.stringify({ access_token: 'access', refresh_token: 'rotated', token_type: 'Bearer', expires_in: 3600 }));
    }) as typeof fetch;
    const result = await app.inject({ method: 'POST', url: '/api/discord/token', payload: {
        grantType: 'authorization_code', code: 'code', codeVerifier: 'v'.repeat(64), redirectUri: 'https://attacker.com',
    } });
    assert.equal(result.statusCode, 200);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(submitted!.get('redirect_uri'), 'https://example.com');
    assert.equal(submitted!.get('code_verifier'), 'v'.repeat(64));
    assert.equal(submitted!.get('client_secret'), 'secret');
    assert.equal(result.json().data.refreshToken, 'rotated');
    assert.ok(result.json().data.expiresAt > Date.now());
    assert.ok(!result.body.includes('secret'));
    const refresh = await app.inject({ method: 'POST', url: '/api/discord/token', payload: { grantType: 'refresh_token', refreshToken: 'old-refresh' } });
    assert.equal(refresh.statusCode, 200);
    assert.equal(submitted!.get('refresh_token'), 'old-refresh');
    assert.equal(submitted!.get('grant_type'), 'refresh_token');
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })) as typeof fetch;
    const invalid = await app.inject({ method: 'POST', url: '/api/discord/token', payload: { grantType: 'refresh_token', refreshToken: 'revoked' } });
    assert.equal(invalid.statusCode, 401);
    globalThis.fetch = (async () => new Response('{}', { status: 503 })) as typeof fetch;
    const unavailable = await app.inject({ method: 'POST', url: '/api/discord/token', payload: { grantType: 'refresh_token', refreshToken: 'valid' } });
    assert.equal(unavailable.statusCode, 502);
    const malformed = await app.inject({ method: 'POST', url: '/api/discord/token', payload: {} });
    assert.equal(malformed.statusCode, 400);
});
