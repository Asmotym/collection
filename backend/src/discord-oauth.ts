import type { FastifyInstance } from 'fastify';

export function registerDiscordOAuth(app: FastifyInstance) {
    app.post('/api/discord/token', async (request, reply) => {
        reply.header('Cache-Control', 'no-store');
        const body = request.body as Record<string, unknown> | null;
        const clientId = process.env.DISCORD_CLIENT_ID;
        const clientSecret = process.env.DISCORD_CLIENT_SECRET;
        const redirectUri = process.env.DISCORD_REDIRECT_URI;
        if (!clientId || !clientSecret || !redirectUri) {
            return reply.code(503).send({ error: 'Discord OAuth is not configured' });
        }
        const params = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });
        if (body?.grantType === 'authorization_code' && typeof body.code === 'string' && body.code
            && typeof body.codeVerifier === 'string' && /^[A-Za-z0-9._~-]{43,128}$/.test(body.codeVerifier)) {
            params.set('grant_type', 'authorization_code');
            params.set('code', body.code);
            params.set('code_verifier', body.codeVerifier);
            params.set('redirect_uri', redirectUri);
        } else if (body?.grantType === 'refresh_token' && typeof body.refreshToken === 'string' && body.refreshToken) {
            params.set('grant_type', 'refresh_token');
            params.set('refresh_token', body.refreshToken);
        } else {
            return reply.code(400).send({ error: 'Invalid token request' });
        }
        try {
            const response = await fetch('https://discord.com/api/v10/oauth2/token', {
                method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params, signal: AbortSignal.timeout(15000),
            });
            const token = await response.json() as Record<string, unknown>;
            if (!response.ok) {
                // Only an invalid grant means the user must sign in again. Keep credentials on transient errors.
                return reply.code(token.error === 'invalid_grant' ? 401 : 502).send({ error: 'Discord token exchange failed' });
            }
            if (typeof token.access_token !== 'string' || !token.access_token
                || typeof token.refresh_token !== 'string' || !token.refresh_token
                || typeof token.token_type !== 'string' || typeof token.expires_in !== 'number' || token.expires_in <= 0) {
                return reply.code(502).send({ error: 'Invalid Discord token response' });
            }
            return { success: true, data: {
                accessToken: token.access_token, refreshToken: token.refresh_token, tokenType: token.token_type,
                expiresIn: token.expires_in, expiresAt: Date.now() + token.expires_in * 1000,
                scope: typeof token.scope === 'string' ? token.scope : '', state: '',
            } };
        } catch {
            return reply.code(502).send({ error: 'Discord token exchange unavailable' });
        }
    });
}
