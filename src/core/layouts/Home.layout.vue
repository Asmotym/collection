<template>
    <HeaderComponent />
    <CollectionBrowser v-if="user" :key="user.id" :collection="collection" :categories="categories"
        :title="t('home.title')" :collection-loading="loading" :error="error" />
    <SignedOutLanding v-else-if="ready" @login="discordService.login()" />
    <AppSkeleton v-else :label="t('common.loading')" />
</template>
<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import HeaderComponent from 'core/components/Header.component.vue';
import CollectionBrowser from 'core/components/CollectionBrowser.component.vue';
import SignedOutLanding from 'core/components/SignedOutLanding.component.vue';
import AppSkeleton from 'core/components/AppSkeleton.component.vue';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import { store } from 'core/store/index.store';
import type { DatabaseCollectionItem, DatabaseCategory } from '../../../shared/types/database.types';
const { t } = useI18n();
const discordService = DiscordService.getInstance();
const user = discordService.user;
const ready = ref(false), loading = ref(false), error = ref('');
const collection = ref<DatabaseCollectionItem[]>([]), categories = ref<DatabaseCategory[]>([]);
let generation = 0;
watch(() => user.value?.id, async (id) => {
    const current = ++generation;
    collection.value = []; categories.value = []; error.value = '';
    if (!id) { loading.value = false; return; }
    loading.value = true;
    try {
        const result = await Promise.all([store.collection().getAll(id), store.category().getAll(id)]);
        if (current === generation) [collection.value, categories.value] = result;
    } catch { if (current === generation) error.value = t('profile.loadError'); }
    finally { if (current === generation) loading.value = false; }
}, { immediate: true });
onMounted(async () => { try { await discordService.handleLogin(); } finally { ready.value = true; } });
</script>
