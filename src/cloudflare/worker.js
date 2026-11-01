import {serve_icon} from './icon.mjs';

// Runs only for what the site's files do not have: /, /icon/ and the server's own paths
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === '/') {
            return env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
        }
        if (url.pathname.startsWith('/icon/')) {
            return serve_icon(request, {cache: caches.default});
        }
        // The site's own paths come only from its files: a missing one is a
        // 404 here, never an old copy left on the server
        if (/^\/(designs|lib)\//.test(url.pathname) || url.pathname.endsWith('.html')) {
            return new Response('Not found', {status: 404});
        }
        // /api, /auth and the rest go on to the server behind navplace.com
        return fetch(request);
    },
};
