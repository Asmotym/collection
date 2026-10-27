import { createApp } from 'vue'
import 'vuetify/dist/vuetify.css'
import 'assets/styles/_vendor.scss'
import '@mdi/font/css/materialdesignicons.css'
import App from './App.vue'
import router from './router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import i18n from 'modules/language-switcher/plugins/i18n.plugin'
import pinia from 'core/plugins/store.plugin'

const vutify = createVuetify({
    components,
    directives,
    icons: {
        defaultSet: 'mdi',
    },
    theme: {
        defaultTheme: 'dark',
        themes: {
            dark: {
                dark: true,
                colors: {
                    background: '#10121D',
                    surface: '#1A1E30',
                    'surface-bright': '#303650',
                    'surface-light': '#252B42',
                    'surface-variant': '#424B68',
                    'on-background': '#F0EFF8',
                    'on-surface': '#F0EFF8',
                    primary: '#B7A1FF',
                    'on-primary': '#241548',
                    secondary: '#70D8CB',
                    'on-secondary': '#082F2D',
                    accent: '#F4B77A',
                    'on-accent': '#3E250D',
                    info: '#8DBFFF',
                    success: '#86D6A5',
                    warning: '#F4C778',
                    error: '#FF969F',
                },
            },
        },
    }
})

const app = createApp(App)
app.use(router)
app.use(vutify)
app.use(i18n)
app.use(pinia)
app.mount('#app')
