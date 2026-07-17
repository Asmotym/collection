<template>
  <v-responsive>
    <v-app>
      <v-main class="app">
        <router-view></router-view>
      </v-main>
    </v-app>
  </v-responsive>
</template>

<script setup lang="ts">
import { watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';

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
