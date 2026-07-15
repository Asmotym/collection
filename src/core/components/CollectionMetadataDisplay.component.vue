<template>
    <div v-if="visibleMetadata.length" class="metadata-display">
        <template v-for="(entry, index) in visibleMetadata" :key="index">
            <a
                v-if="entry.type === 'url'"
                :href="entry.value"
                target="_blank"
                rel="noopener noreferrer"
            >
                {{ entry.name }}
            </a>
            <p v-else class="mb-0">{{ entry.value }}</p>
        </template>
    </div>
    <span v-else-if="!cardsOnly" class="text-medium-emphasis">-</span>
</template>

<script setup lang="ts">
import type { CollectionMetadata } from '../../../shared/types/database.types';
import { computed } from 'vue';

const props = defineProps<{
    metadata: CollectionMetadata[];
    cardsOnly?: boolean;
}>();

const visibleMetadata = computed(() => props.cardsOnly
    ? props.metadata.filter((entry) => entry.showInCards !== false)
    : props.metadata);
</script>

<style scoped>
.metadata-display {
    display: flex;
    flex-direction: column;
    gap: 4px;
    white-space: pre-wrap;
}
</style>
