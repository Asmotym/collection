<template>
    <HeaderComponent />
    <v-container class="dashboard-shell py-6">
        <h1 class="text-h4 mb-3">{{ t('dashboard.title') }}</h1>
        <v-tabs color="primary" class="mb-4">
            <v-tab :to="{ name: HomeRoutes.DashboardCollection }">{{ t('dashboard.tabs.collection') }}</v-tab>
            <v-tab :to="{ name: HomeRoutes.DashboardCategories }">{{ t('dashboard.tabs.categories') }}</v-tab>
        </v-tabs>
        <router-view />
    </v-container>
</template>

<script setup lang="ts">
import HeaderComponent from 'core/components/Header.component.vue';
import { HomeRoutes } from 'core/routes';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>

<style scoped>
.dashboard-shell { max-width: 1600px; }
</style>
