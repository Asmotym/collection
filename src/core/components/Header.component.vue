<template>
    <v-app-bar>
        <template v-slot:prepend>
            <v-app-bar-title class="ml-2">{{ t('common.title') }}</v-app-bar-title>
        </template>

        <v-container class="d-flex justify-center align-center">
            <v-btn variant="text" :to="{ name: HomeRoutes.Base }">
                <span>{{ t('navigation.home') }}</span>
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
import { HomeRoutes } from 'core/routes';

const { t } = useI18n();
</script>

<style scoped>
.header-title {
    font-size: 1.8rem;
    font-weight: bold;
    margin: 0;
}
</style>