import assert from 'node:assert/strict';
import test from 'node:test';
import { categoryDepth, categoryDescendantIds, categorySubtreeHeight } from './category-tree.js';
import type { DatabaseCategory } from '../../shared/types/database.types.js';

const category = (id: number, parent_id: number | null): DatabaseCategory => ({
    id, parent_id, created_by_user_id: 'user', name: `Category ${id}`, position: id, created_at: '',
});
const tree = [category(1, null), category(2, 1), category(3, 2), category(4, null)];

test('calculates category depth and subtree height', () => {
    assert.equal(categoryDepth(3, tree), 3);
    assert.equal(categorySubtreeHeight(1, tree), 3);
    assert.equal(categorySubtreeHeight(4, tree), 1);
});

test('collects every descendant exactly once', () => {
    assert.deepEqual([...categoryDescendantIds(1, tree)].sort(), [1, 2, 3]);
});

test('detects cyclic hierarchies', () => {
    const cyclic = [category(1, 2), category(2, 1)];
    assert.throws(() => categoryDepth(1, cyclic), /cycle/);
    assert.throws(() => categorySubtreeHeight(1, cyclic), /cycle/);
});
