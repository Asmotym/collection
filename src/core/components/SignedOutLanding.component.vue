<template>
    <v-container class="signed-out-page">
        <v-row align="center" class="signed-out-hero">
            <v-col cols="12" md="7" lg="6">
                <div class="hero-kicker"><v-icon icon="mdi-album" size="small" /><span>{{ t('home.signedOut.kicker') }}</span></div>
                <h1 class="hero-title">{{ t('home.signedOut.title') }}</h1>
                <p class="hero-description">{{ t('home.signedOut.description') }}</p>
                <v-btn color="primary" size="x-large" class="hero-cta" @click="emit('login')">
                    <template #prepend>
                        <svg class="hero-discord-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg>
                    </template>{{ t('home.signedOut.cta') }}
                </v-btn>
                <p class="hero-caption">{{ t('home.signedOut.caption') }}</p>
            </v-col>
            <v-col cols="12" md="5" lg="6" class="d-flex justify-center">
                <div class="collection-art" aria-hidden="true">
                    <div class="record-sleeve record-sleeve--back"><v-icon icon="mdi-disc" /></div>
                    <div class="record-sleeve record-sleeve--front"><div class="cover-copy"><span>COLLECTION</span><small>{{ t('home.signedOut.artLabel') }}</small></div></div>
                    <div class="vinyl-record"><div class="vinyl-label"><span /></div></div>
                </div>
            </v-col>
        </v-row>
        <section class="feature-section" :aria-label="t('home.signedOut.featuresLabel')">
            <v-row>
                <v-col v-for="feature in features" :key="feature.key" cols="12" sm="4">
                    <div class="feature-item"><v-icon :icon="feature.icon" color="primary" size="32" /><h2>{{ t(`home.signedOut.features.${feature.key}.title`) }}</h2><p>{{ t(`home.signedOut.features.${feature.key}.text`) }}</p></div>
                </v-col>
            </v-row>
        </section>
    </v-container>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const emit = defineEmits<{ login: [] }>();
const { t } = useI18n();
const features = [
    { key: 'formats', icon: 'mdi-disc-player' },
    { key: 'details', icon: 'mdi-tag-multiple-outline' },
    { key: 'find', icon: 'mdi-magnify' },
] as const;
</script>

<style scoped>
.signed-out-page { width: min(1180px, 100%); min-height: calc(100vh - 64px); padding-block: clamp(48px, 8vw, 96px) 48px; }
.signed-out-hero { min-height: 500px; }
.hero-kicker { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 20px; color: rgb(var(--v-theme-primary)); font-size: .8rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.hero-title { max-width: 720px; font-size: clamp(2.75rem, 7vw, 5.5rem); font-weight: 800; letter-spacing: -.055em; line-height: .98; }
.hero-description { max-width: 620px; margin: 28px 0 32px; color: rgba(var(--v-theme-on-surface), .72); font-size: clamp(1.05rem, 2vw, 1.25rem); line-height: 1.7; }
.hero-cta { text-transform: none; }
.hero-discord-icon { width: 21px; height: 21px; fill: currentColor; }
.hero-caption { margin-top: 12px; color: rgba(var(--v-theme-on-surface), .55); font-size: .85rem; }
.collection-art { position: relative; width: min(430px, 86vw); aspect-ratio: 1.15; }
.record-sleeve, .vinyl-record { position: absolute; width: 68%; aspect-ratio: 1; border-radius: 3px; box-shadow: 0 30px 70px rgba(0, 0, 0, .4); }
.record-sleeve--back { top: 3%; left: 3%; display: grid; place-items: center; transform: rotate(-8deg); background: #cbc0a8; color: rgba(27, 23, 18, .22); }
.record-sleeve--back .v-icon { font-size: 9rem; }
.record-sleeve--front { bottom: 2%; left: 8%; z-index: 2; overflow: hidden; transform: rotate(4deg); background: linear-gradient(145deg, transparent 52%, rgba(255,255,255,.14) 52%), linear-gradient(140deg, #805ad5, #e04f78 55%, #ef8d4e); }
.cover-copy { display: flex; height: 100%; flex-direction: column; justify-content: space-between; padding: 11%; color: white; font-weight: 900; letter-spacing: -.06em; }
.cover-copy > span { max-width: 100%; font-size: clamp(1.5rem, 4.4vw, 2.15rem); letter-spacing: -.07em; white-space: nowrap; }
.cover-copy small { max-width: 160px; font-size: .75rem; font-weight: 700; letter-spacing: .16em; line-height: 1.4; text-transform: uppercase; }
.vinyl-record { top: 13%; right: 0; z-index: 1; display: grid; place-items: center; border-radius: 50%; background: repeating-radial-gradient(circle, #171717 0 3px, #272727 4px 5px); }
.vinyl-label { display: grid; width: 32%; aspect-ratio: 1; place-items: center; border-radius: 50%; background: #f1a34f; }
.vinyl-label span { width: 12%; aspect-ratio: 1; border-radius: 50%; background: #171717; }
.feature-section { margin-top: clamp(40px, 8vw, 88px); padding-top: 40px; border-top: 1px solid rgba(var(--v-theme-on-surface), .12); }
.feature-item { height: 100%; padding: 16px 20px 16px 0; }
.feature-item h2 { margin: 18px 0 8px; font-size: 1.05rem; }
.feature-item p { margin: 0; color: rgba(var(--v-theme-on-surface), .62); line-height: 1.65; }
@media (max-width: 600px) { .signed-out-page { padding-top: 40px; } .signed-out-hero { min-height: 0; } .collection-art { margin-top: 48px; } }
</style>
