<template>
    <HeaderComponent />
    <CollectionBrowser :key="`${userId}:${user?.id ?? 'guest'}`" :title="title"
        :collection="data?.collection ?? []" :categories="data?.categories ?? []"
        :collection-loading="loading" :error="error" />
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import HeaderComponent from 'core/components/Header.component.vue';
import CollectionBrowser from 'core/components/CollectionBrowser.component.vue';
import { api } from 'api/api';
import type { UserCollection } from 'api/routes/user.routes';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
const props = defineProps<{ userId: string }>();
const { t } = useI18n();
const service = DiscordService.getInstance();
const user = service.user;
const data = ref<UserCollection | null>(null), loading = ref(true), error = ref('');
const title = computed(() => data.value ? t('profile.collectionTitle', {
    name: user.value?.id === props.userId ? user.value.username : data.value.owner.username,
}) : t('home.title'));
let generation = 0;
watch([() => props.userId, () => user.value?.id], async () => {
    const current = ++generation;
    data.value = null; loading.value = true; error.value = '';
    try {
        await service.handleLogin();
        if (current !== generation) return;
        const result = await api.user.getCollection(props.userId);
        if (current === generation) data.value = result;
    } catch { if (current === generation) error.value = t('profile.unavailable'); }
    finally { if (current === generation) loading.value = false; }
}, { immediate: true });
</script>
