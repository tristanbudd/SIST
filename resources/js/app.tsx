import '../css/app.css';
import './bootstrap';

import { createInertiaApp, router } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';

const appName = import.meta.env.VITE_APP_NAME || 'SIST';

router.on('navigate', (event) => {
    // @ts-expect-error - GTM dataLayer
    window.dataLayer = window.dataLayer || [];
    // @ts-expect-error - GTM dataLayer
    window.dataLayer.push({
        event: 'inertia_navigate',
        page_path: event.detail.page.url,
        page_title: document.title,
    });
});

interface PageModule {
    default: React.ComponentType;
}

const pages = import.meta.glob<PageModule>('./Pages/**/*.tsx', { eager: true });

const el = document.getElementById('app');
const initialPage = el?.dataset.page ? JSON.parse(el.dataset.page) : undefined;

createInertiaApp({
    title: (title) => (title ? `${appName} | ${title}` : appName),
    page: initialPage,

    resolve: (name) => {
        const page = pages[`./Pages/${name}.tsx`];
        if (!page) {
            throw new Error(`Page Not Found | No page component found for: ${name}`);
        }
        return page.default || page;
    },

    setup({ el, App, props }) {
        const root = createRoot(el);
        root.render(<App {...props} />);
    },

    progress: {
        color: '#0a0a0a',
    },
});
