<template>
    <HeaderComponent />
    <v-container class="settings-page py-6">
        <h1 class="text-h4 mb-6">{{ t('profile.settings') }}</h1>
        <AppSkeleton v-if="loading" :label="t('common.loading')" />
        <template v-else-if="!user">
            <p>{{ t('profile.signInRequired') }}</p>
            <v-btn class="mt-3" @click="service.login()">{{ t('profile.signIn') }}</v-btn>
        </template>
        <v-alert v-else-if="user.id !== userId" type="error">{{ t('profile.accessDenied') }}</v-alert>
        <template v-else-if="settings">
            <div class="d-flex align-center mb-4">
                <h2 class="text-h5">{{ user.username }}</h2>
                <v-btn icon="mdi-pencil" variant="text" :aria-label="t('profile.editName')" :disabled="saving" @click="startEdit" />
            </div>
            <form v-if="editing" @submit.prevent="saveName" class="mb-6">
                <v-text-field v-model="name" :label="t('profile.customName')" :hint="t('profile.nameHint', { name: user.originalUsername })"
                    persistent-hint :disabled="saving" :error-messages="nameTooLong ? t('profile.nameTooLong') : []" />
                <v-btn type="submit" color="primary" :loading="saving" :disabled="nameTooLong">{{ t('profile.save') }}</v-btn>
                <v-btn variant="text" :disabled="saving" @click="editing = false">{{ t('profile.cancel') }}</v-btn>
            </form>
            <v-switch :model-value="settings.collectionShared" :label="t('profile.shareCollection')" color="primary"
                :disabled="saving" hide-details @update:model-value="saveSharing(Boolean($event))" />
            <p class="text-body-2 text-medium-emphasis">{{ t('profile.shareHint') }}</p>
            <v-btn class="mt-3" variant="outlined" prepend-icon="mdi-content-copy" :loading="copying" @click="copyLink">
                {{ t('profile.copyLink') }}
            </v-btn>
            <p v-if="copyStatus" role="status" class="text-body-2 mt-2">{{ t(`profile.${copyStatus}`) }}</p>
        </template>
        <v-alert v-if="error" type="error" class="mt-4">{{ error }}</v-alert>
    </v-container>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import HeaderComponent from 'core/components/Header.component.vue';
import AppSkeleton from 'core/components/AppSkeleton.component.vue';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import { api } from 'api/api';
import type { UserSettingsUpdate } from 'api/routes/user.routes';
import type { DiscordUser } from '../../../shared/types/discord.types';
const props = defineProps<{ userId: string }>();
const { t } = useI18n();
const service = DiscordService.getInstance(), user = service.user;
const loading = ref(true), saving = ref(false), editing = ref(false), name = ref(''), error = ref('');
const settings = ref<DiscordUser | null>(null);
const copying = ref(false);
const copyStatus = ref<'' | 'linkCopied' | 'copyError'>('');
const nameTooLong = computed(() => [...name.value.trim()].length > 80);
let generation = 0;
watch([() => props.userId, () => user.value?.id], async () => {
    const current = ++generation;
    settings.value = null; loading.value = true; editing.value = false; error.value = '';
    copyStatus.value = '';
    try {
        await service.handleLogin();
        if (current !== generation || user.value?.id !== props.userId) return;
        const result = await api.user.getSettings(props.userId);
        if (current === generation) { settings.value = result; service.storeUser(result); }
    } catch { if (current === generation) error.value = t('profile.loadError'); }
    finally { if (current === generation) loading.value = false; }
}, { immediate: true });
function startEdit() { name.value = user.value?.customUsername ?? ''; editing.value = true; error.value = ''; }
async function save(update: UserSettingsUpdate) {
    if (saving.value) return;
    const current = generation, ownerId = props.userId;
    saving.value = true; error.value = '';
    try {
        const result = await api.user.updateSettings(ownerId, update);
        if (current === generation && user.value?.id === ownerId) {
            settings.value = result; service.storeUser(result);
            if ('customUsername' in update) editing.value = false;
        }
    } catch { if (current === generation) error.value = t('profile.saveError'); }
    finally { saving.value = false; }
}
function saveName() { if (!nameTooLong.value) return save({ customUsername: name.value.trim() || null }); }
function saveSharing(shared: boolean) { return save({ collectionShared: shared }); }
async function copyLink() {
    const current = generation;
    copying.value = true;
    copyStatus.value = '';
    try {
        const link = new URL(`/${encodeURIComponent(props.userId)}/collection`, window.location.origin).href;
        await navigator.clipboard.writeText(link);
        if (current === generation) copyStatus.value = 'linkCopied';
    } catch {
        if (current === generation) copyStatus.value = 'copyError';
    } finally { copying.value = false; }
}
</script>
<style scoped>
.settings-page { max-width: 760px; }
</style>
