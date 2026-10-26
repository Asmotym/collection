<template>
    <template v-for="node in nodes" :key="node.id">
        <v-list-group v-if="node.children.length" :value="node.id">
            <template #activator="{ props, isOpen }">
                <v-list-item v-bind="props" :active="selectedId === node.id" @click="emit('select', node.id)">
                    <v-list-item-title>{{ node.name }}</v-list-item-title>
                    <template #append>
                        <span class="text-body-2 text-medium-emphasis ml-2">{{ counts[node.id] ?? 0 }}</span>
                        <v-icon :icon="isOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'" />
                    </template>
                </v-list-item>
            </template>
            <CategoryNavigationList :nodes="node.children" :selected-id="selectedId" :counts="counts" @select="emit('select', $event)" />
        </v-list-group>
        <v-list-item v-else :title="node.name" :active="selectedId === node.id" @click="emit('select', node.id)">
            <template #append><span class="text-body-2 text-medium-emphasis ml-2">{{ counts[node.id] ?? 0 }}</span></template>
        </v-list-item>
    </template>
</template>

<script setup lang="ts">
import type { CategoryTreeNode } from 'core/utils/category-tree.utils';
defineOptions({ name: 'CategoryNavigationList' });
withDefaults(defineProps<{ nodes: CategoryTreeNode[]; selectedId: number | null; counts?: Record<number, number> }>(), { counts: () => ({}) });
const emit = defineEmits<{ select: [id: number] }>();
</script>
