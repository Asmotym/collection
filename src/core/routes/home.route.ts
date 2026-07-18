import type { RouteRecordRaw } from "vue-router";
import HomeLayout from "core/layouts/Home.layout.vue";

export enum HomeRoutes {
    Base = 'Base',
    Dashboard = 'Dashboard',
    About = 'About',
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
    },
    {
        path: '/about',
        name: HomeRoutes.About,
        component: () => import('core/layouts/About.layout.vue'),
    },
]
