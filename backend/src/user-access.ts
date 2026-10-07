import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import type { getDiscordUser } from './discord.js';
import { DEFAULT_USER_PREFERENCES, type DatabaseUser } from '../../shared/types/database.types.js';

export function serializeUser(user: DatabaseUser) {
    return {
        id: user.discord_user_id, username: user.custom_username ?? user.username,
        originalUsername: user.username, customUsername: user.custom_username ?? null,
        collectionShared: user.collection_shared ?? false, avatar: user.avatar,
        rights: user.rights, preferences: { ...DEFAULT_USER_PREFERENCES, ...user.preferences },
    };
}

export function registerUserAccess(app: FastifyInstance, dependencies: {
    pool: Pick<Pool, 'query'>; getDiscordUser: typeof getDiscordUser; collectionItemQuery: string;
}) {
    const { pool, getDiscordUser, collectionItemQuery } = dependencies;
    const owners = new WeakMap<FastifyRequest, DatabaseUser>();
    async function identity(request: FastifyRequest) {
        const match = request.headers.authorization?.match(/^Bearer (\S+)$/i);
        if (!match) return null;
        try {
            return (await getDiscordUser({ tokenType: 'Bearer', accessToken: match[1], expiresIn: 0, scope: '', state: '' })).id;
        } catch { return null; }
    }
    app.addHook('preHandler', async (request, reply) => {
        const route = request.routeOptions.url ?? '';
        const userRoute = route.startsWith('/api/users/');
        const collectionRoute = /^\/api\/(collection|categories)(\/|$)/.test(route);
        if (!userRoute && !collectionRoute) return;
        reply.header('Cache-Control', 'no-store');
        const params = request.params as { id?: string };
        const source = (request.method === 'GET' || request.method === 'DELETE' ? request.query : request.body) as Record<string, unknown> | undefined;
        const rawOwner = userRoute ? params.id : source?.created_by_user_id;
        const ownerId = typeof rawOwner === 'string' ? rawOwner.trim() : '';
        if (!ownerId) return reply.code(400).send({ error: 'Owner is required' });
        const readCollection = request.method === 'GET' && (!userRoute || route.endsWith('/collection'));
        if (readCollection) {
            const result = await pool.query<DatabaseUser>('SELECT * FROM users WHERE discord_user_id = $1', [ownerId]);
            const owner = result.rows[0];
            if (!owner || (!owner.collection_shared && await identity(request) !== ownerId)) {
                return reply.code(404).send({ error: 'Collection unavailable' });
            }
            owners.set(request, owner);
        } else {
            const caller = await identity(request);
            if (!caller) return reply.code(401).send({ error: 'Sign in required' });
            if (caller !== ownerId) return reply.code(403).send({ error: 'Access denied' });
        }
    });
    app.get('/api/users/:id/collection', async (request) => {
        const owner = owners.get(request)!;
        const [items, categories] = await Promise.all([
            pool.query(`${collectionItemQuery} WHERE c.created_by_user_id = $1 ORDER BY c.id`, [owner.discord_user_id]),
            pool.query('SELECT * FROM category WHERE created_by_user_id = $1 ORDER BY parent_id NULLS FIRST, position, id', [owner.discord_user_id]),
        ]);
        return { success: true, data: {
            owner: { id: owner.discord_user_id, username: owner.custom_username ?? owner.username, avatar: owner.avatar },
            collection: items.rows, categories: categories.rows,
        } };
    });
    app.get('/api/users/:id/settings', async (request, reply) => {
        const { id } = request.params as { id: string };
        const result = await pool.query<DatabaseUser>('SELECT * FROM users WHERE discord_user_id = $1', [id]);
        if (!result.rows[0]) return reply.code(404).send({ error: 'User not found' });
        return { success: true, data: serializeUser(result.rows[0]) };
    });
    app.patch('/api/users/:id/settings', async (request, reply) => {
        const body = request.body;
        if (!body || typeof body !== 'object' || Array.isArray(body)) return reply.code(400).send({ error: 'Invalid settings' });
        const settings = body as Record<string, unknown>;
        const keys = Object.keys(settings);
        if (!keys.length || keys.some(key => !['customUsername', 'collectionShared'].includes(key))
            || ('customUsername' in settings && settings.customUsername !== null && typeof settings.customUsername !== 'string')
            || (typeof settings.customUsername === 'string' && [...settings.customUsername.trim()].length > 80)
            || ('collectionShared' in settings && typeof settings.collectionShared !== 'boolean')) {
            return reply.code(400).send({ error: 'Invalid settings' });
        }
        const { id } = request.params as { id: string };
        const result = await pool.query<DatabaseUser>(`UPDATE users SET
            custom_username = CASE WHEN $2 THEN $3 ELSE custom_username END,
            collection_shared = CASE WHEN $4 THEN $5 ELSE collection_shared END
            WHERE discord_user_id = $1 RETURNING *`,
        [id, 'customUsername' in settings, typeof settings.customUsername === 'string' ? settings.customUsername.trim() || null : null,
            'collectionShared' in settings, settings.collectionShared ?? false]);
        if (!result.rows[0]) return reply.code(404).send({ error: 'User not found' });
        return { success: true, data: serializeUser(result.rows[0]) };
    });
}
