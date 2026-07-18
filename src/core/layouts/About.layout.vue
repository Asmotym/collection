<template>
    <HeaderComponent />
    <v-container class="about-page py-8">
        <h1 class="text-h4 mb-2">{{ t('about.title') }}</h1>

        <section class="my-6" aria-labelledby="project-information-title">
            <h2 id="project-information-title" class="text-h5 mb-3">{{ t('about.project.title') }}</h2>
            <p class="text-body-1 mb-3">
                {{ t('about.project.descriptionBeforeAuthor') }}
                <a href="mailto:clement.boucherpro@gmail.com">Clément “Asmotym” Boucher</a>
                (<a href="mailto:clement.boucherpro@gmail.com">clement.boucherpro@gmail.com</a>){{ t('about.project.descriptionAfterAuthor') }}
                <a
                    href="https://github.com/Asmotym/collection"
                    target="_blank"
                    rel="noopener noreferrer"
                >{{ t('about.project.githubLink') }}</a>.
            </p>
            <p class="text-body-1">{{ t('about.project.permissions') }}</p>
        </section>

        <p class="text-body-1 text-medium-emphasis mb-6">{{ t('about.introduction') }}</p>

        <v-list lines="three" rounded="lg" border>
            <v-list-item
                v-for="source in sources"
                :key="source.name"
                :href="source.url"
                target="_blank"
                rel="noopener noreferrer"
                append-icon="mdi-open-in-new"
            >
                <v-list-item-title>{{ source.name }}</v-list-item-title>
                <v-list-item-subtitle>{{ t(source.description) }}</v-list-item-subtitle>
            </v-list-item>
        </v-list>

        <p class="text-body-2 text-medium-emphasis mt-6">{{ t('about.discogsDisclaimer') }}</p>
    </v-container>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import HeaderComponent from 'core/components/Header.component.vue';

const { t } = useI18n();

const sources = [
    {
        name: 'MusicBrainz',
        url: 'https://musicbrainz.org',
        description: 'about.sources.musicbrainz',
    },
    {
        name: 'Cover Art Archive',
        url: 'https://coverartarchive.org',
        description: 'about.sources.coverArtArchive',
    },
    {
        name: 'Discogs',
        url: 'https://www.discogs.com',
        description: 'about.sources.discogs',
    },
    {
        name: 'Fanart.tv',
        url: 'https://fanart.tv',
        description: 'about.sources.fanart',
    },
    {
        name: 'Last.fm',
        url: 'https://www.last.fm',
        description: 'about.sources.lastfm',
    },
] as const;
</script>

<style scoped>
.about-page {
    width: min(800px, 100%);
}

.about-page a {
    color: rgb(var(--v-theme-primary));
}
</style>
