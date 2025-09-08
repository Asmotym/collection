import { createApp } from 'vue'
import 'assets/styles/_vendor.scss'
import 'vuetify/dist/vuetify.css'
import '@mdi/font/css/materialdesignicons.css'
import App from './App.vue'
import router from './router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import i18n from 'modules/language-switcher/plugins/i18n.plugin'

const vutify = createVuetify({
    components,
    directives,
    icons: {
        defaultSet: 'mdi',
    },
    theme: {
        defaultTheme: 'dark',
    }
})

const app = createApp(App)
app.use(router)
app.use(vutify)
app.use(i18n)
app.mount('#app')
