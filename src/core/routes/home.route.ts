import type { RouteRecordRaw } from "vue-router";
import HomeLayout from "core/layouts/Home.layout.vue";

export enum HomeRoutes {
    Base = 'Base',
    Dashboard = 'Dashboard',
}

export const routes: RouteRecordRaw[] = [
    {
        path: '/',
        name: HomeRoutes.Base,
        component: HomeLayout,
    },
    {
        path: '/dashboard',
        name: HomeRoutes.Dashboard,
        component: () => import('core/layouts/Dashboard.layout.vue'),
        meta: {
            requiresAdmin: true,
        },
    },
]
