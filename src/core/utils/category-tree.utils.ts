import type { DatabaseCategory } from '../../../shared/types/database.types';

export interface CategoryTreeNode extends DatabaseCategory {
    children: CategoryTreeNode[];
}

export function buildCategoryTree(categories: DatabaseCategory[]): CategoryTreeNode[] {
    const nodes = new Map(categories.map((category) => [category.id, { ...category, children: [] as CategoryTreeNode[] }]));
    const roots: CategoryTreeNode[] = [];
    for (const category of categories) {
        const node = nodes.get(category.id)!;
        const parent = category.parent_id === null ? undefined : nodes.get(category.parent_id);
        (parent?.children ?? roots).push(node);
    }
    const sort = (items: CategoryTreeNode[]) => {
        items.sort((a, b) => a.position - b.position || a.id - b.id);
        items.forEach((item) => sort(item.children));
    };
    sort(roots);
    return roots;
}

export function categoryPath(categoryId: number, categories: DatabaseCategory[]): string {
    const byId = new Map(categories.map((category) => [category.id, category]));
    const names: string[] = [];
    let current = byId.get(categoryId);
    while (current) {
        names.unshift(current.name);
        current = current.parent_id === null ? undefined : byId.get(current.parent_id);
    }
    return names.join(' > ');
}

export function descendantCategoryIds(categoryId: number, categories: DatabaseCategory[]): Set<number> {
    const ids = new Set([categoryId]);
    let changed = true;
    while (changed) {
        changed = false;
        for (const category of categories) {
            if (category.parent_id !== null && ids.has(category.parent_id) && !ids.has(category.id)) {
                ids.add(category.id);
                changed = true;
            }
        }
    }
    return ids;
}

export function categoryDepth(categoryId: number, categories: DatabaseCategory[]): number {
    const byId = new Map(categories.map((category) => [category.id, category]));
    let depth = 0;
    let current = byId.get(categoryId);
    while (current) {
        depth += 1;
        current = current.parent_id === null ? undefined : byId.get(current.parent_id);
    }
    return depth;
}

export function categorySubtreeHeight(categoryId: number, categories: DatabaseCategory[]): number {
    const children = categories.filter((category) => category.parent_id === categoryId);
    return 1 + Math.max(0, ...children.map((child) => categorySubtreeHeight(child.id, categories)));
}
