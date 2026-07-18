<template>
  <v-responsive class="app-viewport">
    <v-app class="app-shell">
      <v-main class="app-content">
        <router-view></router-view>
      </v-main>
      <AppFooter />
    </v-app>
  </v-responsive>
</template>

<script setup lang="ts">
import { watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';
import AppFooter from 'core/components/AppFooter.component.vue';

const { locale, t } = useI18n();

watchEffect(() => {
  const title = t('meta.title');
  const description = t('meta.description');

  document.documentElement.lang = locale.value;
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
});
</script>

<style>
html,
body,
#app {
  height: 100%;
  overflow: hidden;
}

.app-viewport,
.app-shell {
  height: 100dvh;
  overflow: hidden;
}

.app-content {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
</style>
