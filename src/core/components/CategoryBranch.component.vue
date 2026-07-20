<template>
    <draggable
        :list="nodes"
        item-key="id"
        group="categories"
        handle=".category-drag-handle"
        class="category-drop-zone"
        @change="onChange"
    >
        <template #item="{ element, index }">
            <div class="category-node">
                <div class="category-row">
                    <v-icon class="category-drag-handle" icon="mdi-drag" :title="t('categories.drag')" />
                    <span class="flex-grow-1">{{ element.name }}</span>
                    <v-btn icon="mdi-arrow-up" size="x-small" variant="text" :disabled="index === 0"
                        :aria-label="t('categories.moveUp')" @click="emit('move', element.id, parentId, index - 1)" />
                    <v-btn icon="mdi-arrow-down" size="x-small" variant="text" :disabled="index === nodes.length - 1"
                        :aria-label="t('categories.moveDown')" @click="emit('move', element.id, parentId, index + 1)" />
                    <v-btn v-if="depth < 3" icon="mdi-plus" size="x-small" variant="text"
                        :aria-label="t('categories.addChild')" @click="emit('create', element.id)" />
                    <v-btn icon="mdi-pencil" size="x-small" variant="text"
                        :aria-label="t('categories.rename')" @click="emit('edit', element.id)" />
                    <v-btn icon="mdi-delete" size="x-small" variant="text" color="error"
                        :aria-label="t('categories.delete')" @click="emit('delete', element.id)" />
                </div>
                <CategoryBranch
                    :nodes="element.children"
                    :parent-id="element.id"
                    :depth="depth + 1"
                    @create="(...args) => emit('create', ...args)"
                    @edit="(...args) => emit('edit', ...args)"
                    @delete="(...args) => emit('delete', ...args)"
                    @move="(...args) => emit('move', ...args)"
                />
            </div>
        </template>
    </draggable>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable';
import { useI18n } from 'vue-i18n';
import type { CategoryTreeNode } from 'core/utils/category-tree.utils';

defineOptions({ name: 'CategoryBranch' });
const props = defineProps<{ nodes: CategoryTreeNode[]; parentId: number | null; depth: number }>();
const emit = defineEmits<{
    create: [parentId: number | null];
    edit: [id: number];
    delete: [id: number];
    move: [id: number, parentId: number | null, position: number];
}>();
const { t } = useI18n();

function onChange(event: { added?: { element: CategoryTreeNode; newIndex: number }; moved?: { element: CategoryTreeNode; newIndex: number } }) {
    const change = event.added ?? event.moved;
    if (change) emit('move', change.element.id, props.parentId, change.newIndex);
}
</script>

<style scoped>
.category-drop-zone { min-height: 12px; }
.category-node .category-drop-zone { margin-left: 28px; }
.category-row { display: flex; align-items: center; min-height: 48px; padding: 4px 8px; border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
.category-drag-handle { cursor: grab; margin-right: 8px; }
</style>
