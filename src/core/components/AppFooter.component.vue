<template>
    <v-footer app class="app-footer" :aria-label="t('footer.label')">
        <nav class="app-footer__links" :aria-label="t('footer.links')">
            <a
                href="https://github.com/Asmotym/collection"
                target="_blank"
                rel="noopener noreferrer"
            >
                <v-icon icon="mdi-github" size="small" />
                GitHub
            </a>
            <a href="mailto:clement.boucherpro@gmail.com">
                <v-icon icon="mdi-email-outline" size="small" />
                Contact Me
            </a>
        </nav>
    </v-footer>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<style scoped>
.app-footer {
    flex: 0 0 auto;
    min-height: 48px;
    justify-content: center;
    gap: 12px;
    padding-block: 8px;
    padding-inline: clamp(16px, 4vw, 48px);
    border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    background: rgb(var(--v-theme-surface));
}

.app-footer__links {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px 20px;
}

.app-footer__links a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: rgb(var(--v-theme-on-surface));
    text-decoration: none;
}

.app-footer__links a:hover,
.app-footer__links a:focus-visible {
    color: rgb(var(--v-theme-primary));
    text-decoration: underline;
}

@media (max-width: 600px) {
    .app-footer {
        min-height: 44px;
        padding-block: 6px;
    }

    .app-footer__links {
        gap: 12px;
    }
}
</style>
