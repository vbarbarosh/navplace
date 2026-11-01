import {serve_icon} from './icon.mjs';

// Runs only for what the site's files do not have: / and /icon/; the rest is a 404
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname === '/') {
            return env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
        }
        if (url.pathname.startsWith('/icon/')) {
            return serve_icon(request, {cache: caches.default});
        }
        // navplace.com is its files and /icon/: there is no server behind it
        return new Response('Not found', {status: 404});
    },
};
