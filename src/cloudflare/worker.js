import serve_site from './serve_site.mjs';

// Runs only for what the site's files do not have: /, /icon/, the short addresses of the pages and
// of the designs; the rest is a 404
const worker = {
    fetch: async function (request, env) {
        return serve_site(request, {cache: caches.default, assets: env.ASSETS});
    },
};

export default worker;
