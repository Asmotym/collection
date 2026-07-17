<template>
    <button
        v-if="src && fullWidth"
        type="button"
        class="image-preview-card-trigger"
        :aria-label="t('imagePreview.open', { name: alt })"
        @click="dialogOpen = true"
    >
        <img
            v-if="!thumbnailFailed"
            :src="src"
            :alt="alt"
            class="image-preview-card-image"
            @load="thumbnailLoaded = true"
            @error="thumbnailFailed = true"
        >
        <v-skeleton-loader v-if="!thumbnailLoaded && !thumbnailFailed" class="image-preview-skeleton" type="image" />
        <v-icon v-if="thumbnailFailed" size="48">mdi-image-broken-variant</v-icon>
    </button>
    <v-btn
        v-else-if="src"
        class="image-preview-trigger"
        variant="text"
        :aria-label="t('imagePreview.open', { name: alt })"
        @click="dialogOpen = true"
    >
        <img
            v-if="!thumbnailFailed"
            :src="src"
            :alt="alt"
            class="image-preview-thumbnail"
            @load="thumbnailLoaded = true"
            @error="thumbnailFailed = true"
        >
        <v-skeleton-loader v-if="!thumbnailLoaded && !thumbnailFailed" class="image-preview-skeleton" type="avatar" />
        <v-icon v-if="thumbnailFailed" size="28">mdi-image-broken-variant</v-icon>
    </v-btn>
    <span v-else>-</span>

    <v-dialog v-model="dialogOpen" max-width="900">
        <v-card>
            <v-card-title class="d-flex align-center justify-space-between">
                <span>{{ alt }}</span>
                <v-btn
                    icon="mdi-close"
                    variant="text"
                    :aria-label="t('imagePreview.close')"
                    @click="dialogOpen = false"
                />
            </v-card-title>
            <v-card-text>
                <div class="image-preview-large-wrap">
                    <img
                        v-if="!largeImageFailed"
                        :src="src ?? undefined"
                        :alt="alt"
                        class="image-preview-large"
                        @load="largeImageLoaded = true"
                        @error="largeImageFailed = true"
                    >
                    <v-skeleton-loader v-if="!largeImageLoaded && !largeImageFailed" width="100%" type="image" />
                    <v-icon v-if="largeImageFailed" size="96" color="medium-emphasis">
                        mdi-image-broken-variant
                    </v-icon>
                </div>
                <div class="image-preview-source mt-4">
                    <a :href="src ?? undefined" target="_blank" rel="noopener noreferrer">{{ src }}</a>
                    <v-btn
                        size="small"
                        variant="tonal"
                        prepend-icon="mdi-content-copy"
                        @click="copySource"
                    >
                        {{ t('imagePreview.copy') }}
                    </v-btn>
                </div>
                <v-alert
                    v-if="copyStatus"
                    class="mt-3"
                    density="compact"
                    :type="copyStatus === 'success' ? 'success' : 'error'"
                >
                    {{ t(copyStatus === 'success' ? 'imagePreview.copySuccess' : 'imagePreview.copyFailure') }}
                </v-alert>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{
    src: string | null | undefined;
    alt: string;
    fullWidth?: boolean;
}>();

const { t } = useI18n();
const dialogOpen = ref(false);
const thumbnailFailed = ref(false);
const largeImageFailed = ref(false);
const thumbnailLoaded = ref(false);
const largeImageLoaded = ref(false);
const copyStatus = ref<'success' | 'error' | null>(null);

watch(() => props.src, () => {
    thumbnailFailed.value = false;
    largeImageFailed.value = false;
    thumbnailLoaded.value = false;
    largeImageLoaded.value = false;
    copyStatus.value = null;
});

watch(dialogOpen, (open) => {
    if (open) {
        largeImageFailed.value = false;
        largeImageLoaded.value = false;
        copyStatus.value = null;
    }
});

async function copySource() {
    if (!props.src) {
        return;
    }

    try {
        await navigator.clipboard.writeText(props.src);
        copyStatus.value = 'success';
    } catch {
        copyStatus.value = 'error';
    }
}
</script>

<style scoped>
.image-preview-trigger {
    position: relative;
    width: 50px;
    min-width: 50px;
    height: 50px;
    padding: 0;
    overflow: hidden;
    border-radius: 6px;
}

.image-preview-thumbnail {
    width: 50px;
    height: 50px;
    object-fit: cover;
}

.image-preview-card-trigger {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    aspect-ratio: 1;
    padding: 0;
    overflow: hidden;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
}

.image-preview-skeleton {
    position: absolute;
    inset: 0;
}

.image-preview-card-image {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.image-preview-large-wrap {
    display: flex;
    min-height: 240px;
    align-items: center;
    justify-content: center;
}

.image-preview-large {
    display: block;
    max-width: 100%;
    max-height: 70vh;
    object-fit: contain;
}

.image-preview-source {
    display: flex;
    align-items: center;
    gap: 12px;
}

.image-preview-source a {
    min-width: 0;
    overflow-wrap: anywhere;
    flex: 1;
}
</style>
