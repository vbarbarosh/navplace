const fs = require('fs');
const net = require('net');
const path = require('path');

async function make_socket_server({socket_file, connection_accept})
{
    try {
        await fs.promises.unlink(socket_file);
    }
    catch {
    }

    await fs.promises.mkdir(path.dirname(socket_file), {recursive: true});

    const server = net.createServer(function (sock) {
        sock.destroy();
        connection_accept();
    });

    await new Promise(function (resolve, reject) {
        server.listen(socket_file, resolve);
        server.on('error', reject);
    });

    return {
        [Symbol.asyncDispose]: async function () {
            await new Promise(function (resolve) {
                server.close(resolve);
            });
            try {
                await fs.promises.unlink(socket_file);
            }
            catch {
            }
        },
    };
}

module.exports = make_socket_server;
