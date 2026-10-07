import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUserPreferences } from './user-preferences.js';

test('preference patches preserve unrelated settings', () => {
    assert.deepEqual(normalizeUserPreferences({ cardSize: 'small' }), { cardSize: 'small' });
    for (const field of ['added', 'edited', 'releaseDate', 'alphabetic']) {
        for (const direction of ['asc', 'desc']) {
            const sortBy = `${field}-${direction}`;
            assert.deepEqual(normalizeUserPreferences({ sortBy }), { sortBy });
        }
    }
    assert.deepEqual(normalizeUserPreferences({ cardSize: 'medium', sortBy: 'edited-desc' }),
        { cardSize: 'medium', sortBy: 'edited-desc' });
});

test('rejects invalid preference values', () => {
    for (const value of [null, {}, [], { sortBy: 'bad' }, { sortBy: null }, { cardSize: 'bad' }]) {
        assert.throws(() => normalizeUserPreferences(value));
    }
});
