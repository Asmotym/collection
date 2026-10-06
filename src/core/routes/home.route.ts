import type { RouteRecordRaw } from "vue-router";

export enum HomeRoutes {
    Base = 'Base',
    UserCollection = 'UserCollection',
    UserSettings = 'UserSettings',
    Dashboard = 'Dashboard',
    DashboardCollection = 'DashboardCollection',
    DashboardCategories = 'DashboardCategories',
    About = 'About',
}

export const routes: RouteRecordRaw[] = [
    {
        path: '/:userId/collection', name: HomeRoutes.UserCollection,
        component: () => import('core/views/UserCollection.view.vue'), props: true,
    },
    {
        path: '/:userId/settings', name: HomeRoutes.UserSettings,
        component: () => import('core/views/UserSettings.view.vue'), props: true,
    },
    {
        path: '/',
        name: HomeRoutes.Base,
        component: () => import('core/layouts/Home.layout.vue'),
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
