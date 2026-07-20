<template>
    <AppSkeleton v-if="loading" variant="table" :count="5" :label="t('common.loading')" />
    <template v-else>
        <div class="d-flex align-center justify-space-between mb-4">
            <p class="text-medium-emphasis">{{ t('categories.description') }}</p>
            <v-btn color="primary" prepend-icon="mdi-plus" @click="openCreate(null)">{{ t('categories.addRoot') }}</v-btn>
        </div>
        <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
        <v-card v-if="categories.length">
            <CategoryBranch :nodes="tree" :parent-id="null" :depth="1"
                @create="openCreate" @edit="openEdit" @delete="requestDelete" @move="moveCategory" />
        </v-card>
        <v-empty-state v-else icon="mdi-folder-outline" :title="t('categories.emptyTitle')"
            :text="t('categories.emptyText')" />
    </template>

    <v-dialog v-model="dialogOpen" max-width="520">
        <v-card :title="editingId === null ? t('categories.createTitle') : t('categories.editTitle')">
            <v-card-text>
                <v-text-field v-model="formName" autofocus :label="t('categories.name')" maxlength="100"
                    :rules="[value => !!String(value ?? '').trim() || t('validation.required')]" />
                <v-select v-model="formParentId" :items="parentOptions" item-title="title" item-value="value"
                    :label="t('categories.parent')" />
                <v-alert v-if="dialogError" type="error" variant="tonal" density="compact">{{ dialogError }}</v-alert>
            </v-card-text>
            <v-card-actions class="justify-end">
                <v-btn variant="text" @click="dialogOpen = false">{{ t('dashboard.actions.cancel') }}</v-btn>
                <v-btn color="primary" :loading="saving" :disabled="!formName.trim()" @click="saveCategory">
                    {{ t('dashboard.actions.save') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>

    <v-dialog :model-value="deleting !== null" max-width="520" @update:model-value="deleting = null">
        <v-card :title="t('categories.deleteTitle')">
            <v-card-text>{{ t('categories.deleteConfirm', { name: deleting?.name }) }}</v-card-text>
            <v-card-actions class="justify-end">
                <v-btn variant="text" @click="deleting = null">{{ t('dashboard.actions.cancel') }}</v-btn>
                <v-btn color="error" :loading="saving" @click="confirmDelete">{{ t('dashboard.actions.remove') }}</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import AppSkeleton from 'core/components/AppSkeleton.component.vue';
import CategoryBranch from 'core/components/CategoryBranch.component.vue';
import { store } from 'core/store/index.store';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import { buildCategoryTree, categoryDepth, categoryPath, categorySubtreeHeight, descendantCategoryIds } from 'core/utils/category-tree.utils';
import type { DatabaseCategory } from '../../../shared/types/database.types';

const { t } = useI18n();
const categoryStore = store.category();
const discord = DiscordService.getInstance();
const categories = ref<DatabaseCategory[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const dialogError = ref('');
const dialogOpen = ref(false);
const editingId = ref<number | null>(null);
const formName = ref('');
const formParentId = ref<number | null>(null);
const deleting = ref<DatabaseCategory | null>(null);
const tree = computed(() => buildCategoryTree(categories.value));
const parentOptions = computed(() => {
    const excluded = editingId.value === null ? new Set<number>() : descendantCategoryIds(editingId.value, categories.value);
    const subtreeHeight = editingId.value === null ? 1 : categorySubtreeHeight(editingId.value, categories.value);
    return [{ title: t('categories.noParent'), value: null }, ...categories.value
        .filter((category) => !excluded.has(category.id) && categoryDepth(category.id, categories.value) + subtreeHeight <= 3)
        .map((category) => ({ title: categoryPath(category.id, categories.value), value: category.id }))];
});

async function load() {
    const userId = discord.user.value?.id;
    if (userId) categories.value = await categoryStore.getAll(userId);
}
function openCreate(parentId: number | null) {
    editingId.value = null; formName.value = ''; formParentId.value = parentId; dialogError.value = ''; dialogOpen.value = true;
}
function openEdit(id: number) {
    const category = categories.value.find((item) => item.id === id); if (!category) return;
    editingId.value = id; formName.value = category.name; formParentId.value = category.parent_id;
    dialogError.value = ''; dialogOpen.value = true;
}
async function saveCategory() {
    const userId = discord.user.value?.id; if (!userId || !formName.value.trim()) return;
    saving.value = true; dialogError.value = '';
    try {
        if (editingId.value === null) await categoryStore.create({ created_by_user_id: userId, name: formName.value, parent_id: formParentId.value });
        else {
            const original = categories.value.find((category) => category.id === editingId.value)!;
            await categoryStore.update(editingId.value, { created_by_user_id: userId, name: formName.value });
            if (original.parent_id !== formParentId.value) await categoryStore.move(editingId.value,
                { created_by_user_id: userId, parent_id: formParentId.value, position: Number.MAX_SAFE_INTEGER });
        }
        await load(); dialogOpen.value = false;
    } catch (cause) { dialogError.value = cause instanceof Error ? cause.message : t('categories.saveError'); }
    finally { saving.value = false; }
}
function requestDelete(id: number) { deleting.value = categories.value.find((category) => category.id === id) ?? null; }
async function confirmDelete() {
    const userId = discord.user.value?.id; if (!userId || !deleting.value) return;
    saving.value = true;
    try { await categoryStore.remove(deleting.value.id, userId); await load(); deleting.value = null; }
    catch (cause) { error.value = cause instanceof Error ? cause.message : t('categories.deleteError'); }
    finally { saving.value = false; }
}
async function moveCategory(id: number, parentId: number | null, position: number) {
    const userId = discord.user.value?.id; if (!userId) return;
    const snapshot = [...categories.value];
    try {
        const parentDepth = parentId === null ? 0 : categoryDepth(parentId, snapshot);
        if (descendantCategoryIds(id, snapshot).has(parentId ?? -1) || parentDepth + categorySubtreeHeight(id, snapshot) > 3)
            throw new Error(t('categories.invalidMove'));
        categories.value = await categoryStore.move(id, { created_by_user_id: userId, parent_id: parentId, position });
    } catch (cause) { categories.value = snapshot; error.value = cause instanceof Error ? cause.message : t('categories.moveError'); }
}
onMounted(async () => { try { await discord.handleLogin(); await load(); } catch (cause) { error.value = cause instanceof Error ? cause.message : t('categories.loadError'); } finally { loading.value = false; } });
</script>
