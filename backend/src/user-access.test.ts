import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import type { Pool } from 'pg';
import { registerUserAccess, serializeUser } from './user-access.js';
import type { DatabaseUser } from '../../shared/types/database.types.js';

function setup() {
    const owner: DatabaseUser = { discord_user_id: 'owner', username: 'Discord Name', custom_username: null,
        collection_shared: false, avatar: '', rights: 'user', preferences: { cardSize: 'large', sortBy: 'added-asc' } };
    const app = Fastify();
    const query = async (sql: string, values: unknown[] = []) => {
        if (sql.includes('FROM users')) return { rows: values[0] === 'owner' ? [owner] : [] };
        if (sql.includes('UPDATE users')) {
            if (values[0] !== 'owner') return { rows: [] };
            if (values[1]) owner.custom_username = values[2] as string | null;
            if (values[3]) owner.collection_shared = values[4] as boolean;
            return { rows: [owner] };
        }
        return { rows: [] };
    };
    registerUserAccess(app, {
        pool: { query: query as Pool['query'] }, collectionItemQuery: 'SELECT * FROM collection c',
        getDiscordUser: async auth => {
            if (!['owner', 'visitor'].includes(auth.accessToken)) throw new Error('Invalid credential');
            return { id: auth.accessToken, username: auth.accessToken, avatar: '' };
        },
    });
    for (const url of ['/api/collection', '/api/categories']) {
        app.get(url, async () => ({ success: true }));
        app.post(url, async () => ({ success: true }));
        app.patch(`${url}/:id`, async () => ({ success: true }));
        app.delete(`${url}/:id`, async () => ({ success: true }));
    }
    app.post('/api/collection/compose', async () => ({ success: true }));
    app.post('/api/categories/:id/move', async () => ({ success: true }));
    app.patch('/api/users/:id/preferences', async () => ({ success: true }));
    return { app, owner };
}
const headers = (id: string) => ({ authorization: `Bearer ${id}` });

test('collection privacy covers public pages and legacy reads, including revocation', async () => {
    const { app, owner } = setup();
    try {
        for (const url of ['/api/users/owner/collection', '/api/collection?created_by_user_id=owner', '/api/categories?created_by_user_id=owner']) {
            for (const id of ['', 'invalid', 'visitor']) assert.equal((await app.inject({ url, headers: headers(id) })).statusCode, 404);
            const own = await app.inject({ url, headers: headers('owner') });
            assert.equal(own.statusCode, 200); assert.equal(own.headers['cache-control'], 'no-store');
            owner.collection_shared = true;
            assert.equal((await app.inject({ url })).statusCode, 200);
            assert.equal((await app.inject({ url, headers: headers('visitor') })).statusCode, 200);
            owner.collection_shared = false;
            assert.equal((await app.inject({ url })).statusCode, 404);
        }
        assert.equal((await app.inject('/api/collection')).statusCode, 400);
        assert.equal((await app.inject('/api/users/missing/collection')).statusCode, 404);
    } finally { await app.close(); }
});

test('settings validate ownership, names and allowed fields; custom names survive Discord refresh', async () => {
    const { app, owner } = setup();
    try {
        const url = '/api/users/owner/settings';
        assert.equal((await app.inject({ url })).statusCode, 401);
        assert.equal((await app.inject({ url, headers: headers('invalid') })).statusCode, 401);
        assert.equal((await app.inject({ url, headers: headers('visitor') })).statusCode, 403);
        assert.equal((await app.inject({ url, headers: headers('owner') })).json().data.collectionShared, false);
        const patch = (payload: Record<string, unknown>) => app.inject({ method: 'PATCH', url, headers: headers('owner'), payload });
        assert.equal((await patch({ customUsername: '  My Name  ', collectionShared: true })).json().data.username, 'My Name');
        owner.username = 'New Discord Name';
        assert.equal(serializeUser(owner).username, 'My Name');
        assert.equal((await patch({ customUsername: '   ' })).json().data.username, 'New Discord Name');
        assert.equal(owner.collection_shared, true);
        for (const payload of [{ rights: 'admin' }, { customUsername: 'a'.repeat(81) }, { collectionShared: 'true' }, { customUsername: 12 }, {}]) {
            assert.equal((await patch(payload)).statusCode, 400);
        }
        assert.equal((await patch({ customUsername: 'a'.repeat(80) })).statusCode, 200);
    } finally { await app.close(); }
});

test('existing writes reject missing credentials and forged owner IDs', async () => {
    const { app } = setup();
    try {
        const routes = [
            ['POST', '/api/collection'], ['POST', '/api/collection/compose'], ['PATCH', '/api/collection/1'],
            ['POST', '/api/categories'], ['PATCH', '/api/categories/1'], ['POST', '/api/categories/1/move'],
            ['PATCH', '/api/users/owner/preferences'], ['PATCH', '/api/users/owner/settings'],
            ['DELETE', '/api/collection/1?created_by_user_id=owner'], ['DELETE', '/api/categories/1?created_by_user_id=owner'],
        ] as const;
        for (const [method, url] of routes) {
            for (const [id, expected] of [['', 401], ['invalid', 401], ['visitor', 403]] as const) {
                const result = await app.inject({ method, url, headers: headers(id),
                    ...(method !== 'DELETE' ? { payload: { created_by_user_id: 'owner' } } : {}) });
                assert.equal(result.statusCode, expected, `${method} ${url}`);
            }
        }
    } finally { await app.close(); }
});
