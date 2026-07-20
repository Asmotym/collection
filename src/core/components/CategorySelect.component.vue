<template>
    <div class="mb-4">
        <v-autocomplete
            v-if="categories.length"
            :model-value="modelValue"
            :items="items"
            item-title="title"
            item-value="value"
            :label="t('categories.assignmentLabel')"
            chips
            closable-chips
            multiple
            clearable
            @update:model-value="emit('update:modelValue', $event)"
        />
        <v-alert v-else type="info" variant="tonal" density="compact">
            {{ t('categories.noCategoriesForAssignment') }}
            <v-btn variant="text" size="small" :to="{ name: HomeRoutes.DashboardCategories }">
                {{ t('categories.manage') }}
            </v-btn>
        </v-alert>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { HomeRoutes } from 'core/routes';
import { categoryPath } from 'core/utils/category-tree.utils';
import type { DatabaseCategory } from '../../../shared/types/database.types';

const props = defineProps<{ modelValue: number[]; categories: DatabaseCategory[] }>();
const emit = defineEmits<{ 'update:modelValue': [value: number[]] }>();
const { t } = useI18n();
const items = computed(() => props.categories.map((category) => ({
    title: categoryPath(category.id, props.categories), value: category.id,
})));
</script>
