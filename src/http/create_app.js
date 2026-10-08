const als = require('./helpers/als');
const db = require('../../db');
const express = require('express');
const express_fingerprint = require('@vbarbarosh/express-helpers/src/express_fingerprint');
const express_routes = require('./helpers/express/express_routes');
const format_hrtime0 = require('./helpers/format/format_hrtime0');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const random_uid = require('./helpers/random/random_uid');
const user_create = require('./models/user_create');
const {sentry_request_context} = require('./services/sentry');
const {setup_websockets} = require('./services/events');

const LOGGED_HEADERS = new Set([
    'user-agent',
    'content-type',
    'content-length',
    'referer',
    'origin',
    'host',
    'x-forwarded-for',
    'x-forwarded-proto',
    'x-real-ip',
]);

async function create_app()
{
    const app = express();

    let pending = 0;
    app.use(function (req, res, next) {

        pending++;
        const hrtime0 = process.hrtime();
        const logger = als.logger.spawn({decorate: s => `[+${format_hrtime0(hrtime0, 4)}] ${s}`});

        req.uid = random_uid('req_');
        logger.write(`[req_uid] ${req.uid}`);

        const headers = Object.fromEntries(Object.keys(req.headers).filter(v => LOGGED_HEADERS.has(v)).map(k => [k, req.headers[k]]));
        logger.write(`[req_begin] ${req.method} ${JSON.stringify(req.url)} ${JSON.stringify(express_fingerprint(req))} ${JSON.stringify(headers)}`);

        res.on('close', function () {
            pending--;
            logger.write(`[res_close] ${res.statusCode} ${JSON.stringify(res.statusMessage)} pending=${pending}`);
        });
        req.on('error', function (error) {
            logger.write(`[req_error] ${JSON.stringify({...error, message: error.message, stack: error.stack && error.stack.split(/\n\s*/)}, null, 4)}`);
        });

        als.run({logger}, () => next());
    });

    app.use(sentry_request_context);
    app.use(express.json({limit: '1mb'}));
    app.use(async function (req, res, next) {
        const authwall_user_uid = req.headers['x-auth-user'];
        if (!authwall_user_uid) {
            req.user = null;
        }
        else {
            req.user = await db('users').where({authwall_user_uid}).first();
            req.user ??= await user_create({authwall_user_uid});
        }
        next();
    });

    app.use('/lib', express.static(fs_path_resolve(`${__dirname}/../../lib`)));
    app.use('/designs', express.static(fs_path_resolve(`${__dirname}/../../designs`)));

    express_routes(app, require('./routes/landing'));
    express_routes(app, require('./routes/health'));
    express_routes(app, require('./routes/dashboard'));
    express_routes(app, require('./routes/api/collections'));

    // Sentry 11's Express integration captures the errors itself (5xx and ones with no status)
    app.use(error_handler);

    app.setup_server = setup_websockets;

    return app;
}

async function error_handler(error, req, res, next)
{
    try {
        const details = {
            status: error.response?.status,
            body: error.response?.data,
            headers: error.response?.headers,
            stack: error.stack,
            url: req.url,
            originalUrl: req.originalUrl,
        };
        als.logger.write(`[error_handler] ⚠️ ${JSON.stringify(details)}`);
    }
    catch (error2) {
        als.logger.write(`[error_handler] ⚠️ ${JSON.stringify(error.stack).slice(1, -1)} url=${req.url} originalUrl=${req.originalUrl}`);
    }

    res.status(error.status_code || error.statusCode || 400).send(error.message);
}

module.exports = create_app;
