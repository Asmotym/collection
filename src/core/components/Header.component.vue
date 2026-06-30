<template>
    <v-app-bar>
        <template v-slot:prepend>
            <v-app-bar-title class="ml-2">{{ t('common.title') }}</v-app-bar-title>
        </template>

        <v-container class="d-flex justify-center align-center">
            <v-btn variant="text" :to="{ name: HomeRoutes.Base }">
                <span>{{ t('navigation.home') }}</span>
            </v-btn>
            <v-btn v-if="isAdmin" variant="text" :to="{ name: HomeRoutes.Dashboard }">
                <span>{{ t('navigation.dashboard') }}</span>
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
import { computed } from 'vue';
import LanguageSwitcher from 'modules/language-switcher/components/LanguageSwitcher.vue';
import DiscordAuth from 'modules/discord-auth/components/DiscordAuth.vue';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import { HomeRoutes } from 'core/routes';

const { t } = useI18n();
const discordService = DiscordService.getInstance();
const isAdmin = computed(() => discordService.user.value?.rights === 'admin');
</script>

<style scoped>
.header-title {
    font-size: 1.8rem;
    font-weight: bold;
    margin: 0;
}
</style>
