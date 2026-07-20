import type { RouteRecordRaw } from "vue-router";
import HomeLayout from "core/layouts/Home.layout.vue";

export enum HomeRoutes {
    Base = 'Base',
    Dashboard = 'Dashboard',
    DashboardCollection = 'DashboardCollection',
    DashboardCategories = 'DashboardCategories',
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
        redirect: { name: HomeRoutes.DashboardCollection },
        children: [
            {
                path: 'collection',
                name: HomeRoutes.DashboardCollection,
                component: () => import('core/views/CollectionDashboard.view.vue'),
            },
            {
                path: 'categories',
                name: HomeRoutes.DashboardCategories,
                component: () => import('core/views/CategoriesDashboard.view.vue'),
            },
        ],
    },
    {
        path: '/about',
        name: HomeRoutes.About,
        component: () => import('core/layouts/About.layout.vue'),
    },
]
