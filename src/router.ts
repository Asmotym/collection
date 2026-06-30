import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { coreRoutes, HomeRoutes } from "core/routes";
import { DiscordService } from "modules/discord-auth/services/discord.service";

const routes: RouteRecordRaw[] = [
    ...coreRoutes,
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

router.beforeEach((to) => {
    if (!to.meta.requiresAdmin) {
        return true;
    }

    const discordService = DiscordService.getInstance();
    const user = discordService.user.value ?? discordService.getUser();

    if (user?.rights === 'admin') {
        return true;
    }

    return { name: HomeRoutes.Base };
});

export default router
