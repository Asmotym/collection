import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { coreRoutes } from "core/routes";

const routes: RouteRecordRaw[] = [
    ...coreRoutes,
];

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router