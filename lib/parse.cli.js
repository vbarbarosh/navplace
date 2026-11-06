#!/usr/bin/env node

const cli = require('@vbarbarosh/node-helpers/src/cli');
const parse = require('./parse');

cli(main);

async function main()
{
    const collection = parse(`
% design: github
% ns: foo

# foo
ChatGPT https://chatgpt.com/
# bar
GitHub  https://github.com/
# foo | bar
Gmail   https://mail.google.com/
    `);
    console.log(collection);
}
