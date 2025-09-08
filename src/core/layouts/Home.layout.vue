<template>
    <HeaderComponent />
    <v-container v-if="userLoggedIn" class="py-6">
        <div class="text-center mb-6">
            <h1 class="text-h3 mb-2">🎲 Dice Rolz RPG</h1>
            <p class="text-body-1 text-medium-emphasis">Your ultimate tabletop gaming companion</p>
        </div>
        
        <DiceRollerComponent />
    </v-container>
    <v-container v-else class="d-flex justify-center align-center" style="height: 100vh">
        <v-card :title="t('home.not_logged_in_title')" :text="t('home.not_logged_in_message')"></v-card>
    </v-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import HeaderComponent from 'core/components/Header.component.vue';
import DiceRollerComponent from 'core/components/DiceRoller.component.vue';
import { DiscordService } from 'modules/discord-auth/services/discord.service';

const { t } = useI18n();

const discordService = DiscordService.getInstance();
const userLoggedIn = computed(() => {
  return discordService.user.value !== null;
});

</script>