<template>
    <HeaderComponent />
    <v-container v-if="userLoggedIn" class="py-6">
        <h1 class="text-h4 mb-4">{{ t('home.title') }}</h1>
        <v-row v-if="collection.length > 0">
            <v-col v-for="item in collection" :key="item.id" cols="12" sm="5" md="3">
                <v-card>
                    <v-card-title>
                        {{ item.album_name }}<span class="text-body-secondary">({{ item.album_year ?? '-' }})</span>
                    </v-card-title>
                    <v-card-subtitle>
                        {{ item.artist_name }}
                    </v-card-subtitle>
                    <div v-if="item.album_image" class="mt-3 pl-4 pr-4">
                        <ImagePreview
                            :src="item.album_image"
                            :alt="item.album_name"
                            full-width
                        />
                    </div>
                    <v-card-text>
                        <CollectionMetadataDisplay :metadata="item.metadata" cards-only />
                    </v-card-text>
                </v-card>
            </v-col>
        </v-row>
    </v-container>
    <v-container v-else class="d-flex justify-center align-center" style="height: 100vh">
        <v-card :title="t('home.not_logged_in_title')" :text="t('home.not_logged_in_message')"></v-card>
    </v-container>
</template>

<script setup lang="ts">
import type { CollectionItem } from 'core/store/stores/collection.store';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import HeaderComponent from 'core/components/Header.component.vue';
import ImagePreview from 'core/components/ImagePreview.component.vue';
import CollectionMetadataDisplay from 'core/components/CollectionMetadataDisplay.component.vue';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import { store } from 'core/store/index.store';

const { t } = useI18n();

const discordService = DiscordService.getInstance();
const userLoggedIn = computed(() => {
  return discordService.user.value !== null;
});
const collectionStore = store.collection();
const collection = ref<CollectionItem[]>([]);

onMounted(async () => {
    const user = await discordService.handleLogin();

    if (user) {
        collection.value = await collectionStore.getAll(user.id);
    }
})
</script>
