<template>
    <template v-for="node in nodes" :key="node.id">
        <v-list-group v-if="node.children.length" :value="node.id">
            <template #activator="{ props }">
                <v-list-item v-bind="props" :active="selectedId === node.id" @click="emit('select', node.id)">
                    <v-list-item-title>{{ node.name }}</v-list-item-title>
                </v-list-item>
            </template>
            <CategoryNavigationList :nodes="node.children" :selected-id="selectedId" @select="emit('select', $event)" />
        </v-list-group>
        <v-list-item v-else :title="node.name" :active="selectedId === node.id" @click="emit('select', node.id)" />
    </template>
</template>

<script setup lang="ts">
import type { CategoryTreeNode } from 'core/utils/category-tree.utils';
defineOptions({ name: 'CategoryNavigationList' });
defineProps<{ nodes: CategoryTreeNode[]; selectedId: number | null }>();
const emit = defineEmits<{ select: [id: number] }>();
</script>
