<template>
    <v-app-bar class="app-header">
        <template v-slot:prepend>
            <v-app-bar-title class="app-header-title ml-2">{{ t('common.title') }}</v-app-bar-title>
        </template>

        <v-container class="header-navigation d-flex justify-center align-center">
            <v-btn variant="text" :to="{ name: HomeRoutes.Base }">
                <span>{{ t('navigation.home') }}</span>
            </v-btn>
            <v-btn v-if="user" variant="text" :to="{ name: HomeRoutes.DashboardCollection }">
                <span>{{ t('navigation.dashboard') }}</span>
            </v-btn>
            <v-btn variant="text" :to="{ name: HomeRoutes.About }">
                <span>{{ t('navigation.about') }}</span>
            </v-btn>
        </v-container>

        <template v-slot:append>    
            <LanguageSwitcher />
            <DiscordAuth />
        </template>
    </v-app-bar>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import LanguageSwitcher from 'modules/language-switcher/components/LanguageSwitcher.vue';
import DiscordAuth from 'modules/discord-auth/components/DiscordAuth.vue';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import { HomeRoutes } from 'core/routes';

const { t } = useI18n();
const user = DiscordService.getInstance().user;
</script>

<style scoped>
.header-title {
    font-size: 1.8rem;
    font-weight: bold;
    margin: 0;
}

@media (max-width: 599.98px) {
    .app-header-title {
        display: none;
    }
    .header-navigation {
        min-width: 0;
        margin: 0;
        padding: 0;
        justify-content: flex-start !important;
    }
    .header-navigation .v-btn {
        min-width: 0;
        padding-inline: 8px;
        font-size: .75rem;
    }
    .app-header :deep(.v-toolbar__prepend) {
        margin-inline: 0;
    }
    .app-header :deep(.v-toolbar__append) {
        flex-shrink: 0;
        margin-inline-end: 4px;
    }
    .app-header :deep(.language-switcher) {
        min-width: 40px;
        margin-inline-end: 0 !important;
        padding-inline: 8px;
    }
    .app-header :deep(.language-switcher .v-icon) {
        margin-inline-end: 0 !important;
    }
    .app-header :deep(.language-switcher .fallback-text) {
        display: none;
    }
    .app-header :deep(.user-section) {
        padding: 0;
    }
    .app-header :deep(.user-section .v-row) {
        margin: 0;
    }
}
</style>
