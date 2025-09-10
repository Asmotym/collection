<template>
    <HeaderComponent />
    <v-container v-if="userLoggedIn" class="py-6">
        Hello World!
    </v-container>
    <v-container v-else class="d-flex justify-center align-center" style="height: 100vh">
        <v-card :title="t('home.not_logged_in_title')" :text="t('home.not_logged_in_message')"></v-card>
    </v-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import HeaderComponent from 'core/components/Header.component.vue';
import { DiscordService } from 'modules/discord-auth/services/discord.service';

const { t } = useI18n();

const discordService = DiscordService.getInstance();
const userLoggedIn = computed(() => {
  return discordService.user.value !== null;
});

</script>