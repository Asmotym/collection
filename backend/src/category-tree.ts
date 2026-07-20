import type { DatabaseCategory } from '../../shared/types/database.types.js';

export function categoryDepth(categoryId: number, categories: DatabaseCategory[]): number {
    const byId = new Map(categories.map((category) => [category.id, category]));
    let depth = 0;
    let current: DatabaseCategory | undefined = byId.get(categoryId);
    const visited = new Set<number>();
    while (current) {
        if (visited.has(current.id)) throw new Error('Category hierarchy contains a cycle');
        visited.add(current.id);
        depth += 1;
        current = current.parent_id === null ? undefined : byId.get(current.parent_id);
    }
    return depth;
}

export function categorySubtreeHeight(categoryId: number, categories: DatabaseCategory[]): number {
    const children = new Map<number, number[]>();
    for (const category of categories) {
        if (category.parent_id !== null) children.set(category.parent_id,
            [...(children.get(category.parent_id) ?? []), category.id]);
    }
    const height = (id: number, path = new Set<number>()): number => {
        if (path.has(id)) throw new Error('Category hierarchy contains a cycle');
        return 1 + Math.max(0, ...(children.get(id) ?? []).map((child) => height(child, new Set(path).add(id))));
    };
    return height(categoryId);
}

export function categoryDescendantIds(categoryId: number, categories: DatabaseCategory[]): Set<number> {
    const result = new Set<number>([categoryId]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const category of categories) {
            if (category.parent_id !== null && result.has(category.parent_id) && !result.has(category.id)) {
                result.add(category.id);
                changed = true;
            }
        }
    }
    return result;
}
