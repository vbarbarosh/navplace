const Promise = require('bluebird');

// Provide access to an object only after it was initialized
function make_init_proxy(init)
{
    if (typeof init !== 'function') {
        throw new Error('init must be a function');
    }

    let status = 'idle'; // idle | running | ready
    let object = null;

    return new Proxy({}, {
        get: function (target, prop, receiver) {
            if (prop === 'init') {
                return async function (...args) {
                    if (status === 'ready') {
                        throw new Error('init() was already called');
                    }
                    if (status === 'running') {
                        throw new Error('init() is already running');
                    }

                    status = 'running';
                    try {
                        const initialized = await Promise.resolve(init.apply(this, args));
                        if ((initialized === null) || (typeof initialized !== 'object')) {
                            throw new Error('init() must return an object');
                        }
                        object = initialized;
                        status = 'ready';
                    }
                    finally {
                        if (status === 'running') {
                            status = 'idle';
                        }
                    }
                };
            }

            status_assert_ready();
            const value = Reflect.get(object, prop, object);
            return (typeof value === 'function') ? value.bind(object) : value;
        },
        set: function (target, prop, value, receiver) {
            status_assert_ready();
            if (prop === 'init') {
                throw new Error('init() cannot be replaced');
            }

            return Reflect.set(object, prop, value, object);
        },
        has: function (target, prop) {
            status_assert_ready();
            return Reflect.has(object, prop);
        },
        deleteProperty: function (target, prop) {
            status_assert_ready();
            return Reflect.deleteProperty(object, prop);
        },
        ownKeys: function (target) {
            status_assert_ready();
            return Reflect.ownKeys(object);
        },
        getOwnPropertyDescriptor: function (target, prop) {
            status_assert_ready();
            return Reflect.getOwnPropertyDescriptor(object, prop);
        },
    });

    function status_assert_ready() {
        if (status === 'idle') {
            throw new Error('init() must be called first');
        }
        if (status === 'running') {
            throw new Error('init() is still running');
        }
    }
}

module.exports = make_init_proxy;
