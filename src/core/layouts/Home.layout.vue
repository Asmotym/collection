<template>
    <HeaderComponent />
    <v-container v-if="userLoggedIn" class="py-6">
        <v-row v-if="collection.length > 0">
            <v-col v-for="item in collection" :key="item.id" cols="12" sm="5" md="3">
                <v-card>
                    <v-card-title>
                        {{ item.album_name }}<span class="text-body-secondary">({{ item.album_year }})</span>
                    </v-card-title>
                    <v-card-subtitle>
                        {{ item.artist_name }}
                    </v-card-subtitle>
                    <v-card-text>
                        <v-img :src="item.album_image" :alt="item.album_name" />
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
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import { store } from 'core/store/index.store';

const { t } = useI18n();

const discordService = DiscordService.getInstance();
const userLoggedIn = computed(() => {
  return discordService.user.value !== null;
});
const collectionStore = store.collection();
const collection = ref<CollectionItem[]>([]);

// const collection = ref<CollectionItem[]>([
//     {
//         id: 1,
//         artist: 'Artist 1',
//         album: {
//             name: 'Album 1',
//             year: 2021,
//             image: 'https://placehold.co/150',
//         },
//     },
//     {
//         id: 2,
//         artist: 'Artist 2',
//         album: {
//             name: 'Album 2',
//             year: 2022,
//             image: 'https://placehold.co/150',
//         },
//     },
//     {
//         id: 3,
//         artist: 'Artist 3',
//         album: {
//             name: 'Album 3',
//             year: 2023,
//             image: 'https://placehold.co/150',
//         },
//     },
//     {
//         id: 4,
//         artist: 'Artist 4',
//         album: {
//             name: 'Album 4',
//             year: 2024,
//             image: 'https://placehold.co/150',
//         },
//     },
//     {
//         id: 5,
//         artist: 'Artist 5',
//         album: {
//             name: 'Album 5',
//             year: 2025,
//             image: 'https://placehold.co/150',
//         },
//     },
//     {
//         id: 6,
//         artist: 'Artist 6',
//         album: {
//             name: 'Album 6',
//             year: 2026,
//             image: 'https://placehold.co/150',
//         },
//     },
//     {
//         id: 7,
//         artist: 'Artist 7',
//         album: {
//             name: 'Album 7',
//             year: 2027,
//             image: 'https://placehold.co/150',
//         },
//     },
// ])

onMounted(async () => {
    collection.value = await collectionStore.getAll();
})
</script>