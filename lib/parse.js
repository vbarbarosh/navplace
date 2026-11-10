// options: {prefix, suffix, tags} decorate every item — used by `% include:`;
// {spans: true} adds each link's line and where its parts sit in it — used by the Playground.
// A line that does not parse is skipped, the rest kept: {line, text, message} in `warnings`,
// which is there only when there are any
function parse(text, options)
{
    let ns_block = [];
    let namespaces = [];

    options = options || {};
    const prefix = options.prefix || '';
    const suffix = options.suffix || '';
    const common_tags = options.tags || [];
    const meta = {};
    const items = [];
    const warnings = [];

    const lines = text.split('\n');
    for (let i = 0, end = lines.length; i < end; ++i) {
        const raw = lines[i];
        const line = raw.trim();
        if (!line) {
            if (ns_block.length) {
                namespaces = namespaces_from_lines(ns_block);
                ns_block = [];
            }
            continue;
        }

        if (line[0] === '%') {
            let directive;
            try {
                directive = directive_from_line(line);
            }
            catch (error) {
                warnings.push({line: i + 1, text: line, message: error.message});
                continue;
            }
            // `% include:` is repeatable; every other directive keeps its last value
            if (directive.include) {
                directive.include = [...(meta.include || []), ...directive.include];
            }
            // `% picture <name>:` adds a name to meta.picture; the same name again replaces it
            if (directive.picture) {
                directive.picture = {...meta.picture, ...directive.picture};
            }
            Object.assign(meta, directive);
            continue;
        }

        if (line[0] === '#') {
            ns_block.push(line);
            continue;
        }

        if (ns_block.length) {
            namespaces = namespaces_from_lines(ns_block);
            ns_block = [];
        }

        let item;
        try {
            item = item_from_line(line, namespaces);
        }
        catch (error) {
            warnings.push({line: i + 1, text: line, message: `Invalid link line: ${line}`});
            continue;
        }
        if (item && options.spans) {
            item.line = i + 1;
            item.spans = item_spans_from_line(line, raw.length - raw.trimStart().length);
        }
        if (item) {
            items.push(item);
        }
    }

    // `@name` takes the url of `% picture <name>:`, declared anywhere in the file, the end too;
    // a name with no picture stays a file under ~/.navplace/
    if (meta.picture) {
        for (const item of items) {
            const name = item.image_url && item.image_url.slice('private://'.length);
            if (name && Object.prototype.hasOwnProperty.call(meta.picture, name)) {
                item.image_url = meta.picture[name];
            }
        }
    }

    // `% include:` hands a pulled document the ns of the document pulling it,
    // so the filter runs over local and pulled links alike
    const ns = options.ns || meta.ns;
    const kept = ns ? items.filter(v => v.namespaces.some(vv => ns.includes(vv))) : items;
    return warnings.length ? {meta, items: kept, warnings} : {meta, items: kept};

    function text_squeeze_spaces(text) {
        return text.trim().replace(/\s+/g, ' ');
    }

    function namespaces_from_lines(lines) {
        return lines.map(v => v.replace(/^#+/, '').trim()).join(' ').split('|').map(text_squeeze_spaces).filter(Boolean);
    }

    function directive_from_line(line) {
        // % key: value. The key stands before the first colon, a character of it at least; the value is
        // the rest, on one line. No pattern reads it: `%\s*([^:]+)\s*:` took 2 seconds on 2000 spaces
        // with no colon after them, 8 times more for each doubling
        const key_end = line.indexOf(':');
        const value = line.slice(key_end + 1).trim();
        if ((key_end < 2) || !value || /[\n\r\u2028\u2029]/.test(value)) {
            throw new Error(`Invalid meta line: ${line}`);
        }

        const key = text_squeeze_spaces(line.slice(1, key_end));
        if (key === 'ns') {
            return {ns: value.split('|').map(text_squeeze_spaces).filter(Boolean)};
        }
        else if (key === 'include') {
            return {include: [value]};
        }
        else if (/^picture(\s|$)/.test(key)) {
            // % picture kimi: https://… or data:image/…; with no name it is no picture, never a key of its own
            const name = key.slice('picture'.length).trim();
            if (!/^\S+$/.test(name) || !/^(https?:\/\/|data:image\/)[^\s"'<>]+$/.test(value)) {
                throw new Error(`Invalid picture line: ${line}`);
            }
            return {picture: {[name]: value}};
        }
        else {
            return {[key]: value};
        }
    }

    function item_from_line(line, namespaces) {
        // The href is always last
        const href_begin = href_begin_from_line(line);
        if (href_begin < 0) {
            return null;
        }

        let head = line.slice(0, href_begin).trim();

        const href = line.slice(href_begin);

        let image_url = null;

        // `@name` right before the url, after the label or opening a line that has none
        const image_begin = image_begin_from_head(head);
        if (image_begin >= 0) {
            image_url = `private://${head.slice(image_begin + 1)}`;
            head = head.slice(0, image_begin).trim();
        }

        const line_tags = [];
        const meta = {};
        // A tag or a `#key=value` opens the name or follows a space: a `#` inside a word is the name's own.
        // Each leaves a line break, which no line holds: the name is the pieces around them, one space between
        head = head.replace(/(^|\s)#([a-zA-Z0-9_-]+)(?:=(\S*))?/g, tag_take).split('\n').map(v => v.trim()).filter(Boolean).join(' ');

        const tags = [...line_tags, ...common_tags];

        const url = new URL(href);
        const domain = url.host;
        const plain_label = head || label_from_href(href);
        const label = [prefix, plain_label, suffix].filter(Boolean).join(' ');
        const letter = plain_label.match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase() ?? '';

        return {
            label,
            href,
            icon_url: icon_url_from_domain(domain, letter),
            image_url,
            tags,
            meta,
            search1: text_transliterate([label, ...tags].join(' ')),
            search2: text_transliterate(href),
            namespaces,
        };

        function tag_take(_, lead, key, value) {
            if (value === undefined) {
                line_tags.push(key);
            }
            else {
                meta[key] = value;
            }
            return '\n';
        }
    }

    // Columns [begin, end) in the raw line, found the way item_from_line finds the parts:
    // {label: [[begin, end], …], href: [begin, end], image: [begin, end] | null, tags: [{name, at}], meta: [{key, value, at}]}
    function item_spans_from_line(line, lead) {
        const href_begin = href_begin_from_line(line);

        let head_end = line.slice(0, href_begin).trimEnd().length;
        let image = null;

        const image_begin = image_begin_from_head(line.slice(0, head_end));
        if (image_begin >= 0) {
            image = [lead + image_begin, lead + head_end];
            head_end = line.slice(0, image_begin).trimEnd().length;
        }
        const tags = [];
        const meta = [];
        const taken = [];
        const head = line.slice(0, head_end);
        for (const tag_match of head.matchAll(/(^|\s)#([a-zA-Z0-9_-]+)(?:=(\S*))?/g)) {
            const tag_begin = tag_match.index + tag_match[1].length;
            const tag_end = tag_match.index + tag_match[0].length;
            const at = [lead + tag_begin, lead + tag_end];
            taken.push([tag_begin, tag_end]);
            if (tag_match[3] === undefined) {
                tags.push({name: tag_match[2], at});
            }
            else {
                meta.push({key: tag_match[2], value: tag_match[3], at});
            }
        }

        let begin = 0;

        const label = [];
        for (const [taken_begin, taken_end] of [...taken, [head_end, head_end]]) {
            const piece = head.slice(begin, taken_begin);
            const piece_begin = begin + (piece.length - piece.trimStart().length);
            const piece_end = begin + piece.trimEnd().length;
            if (piece_end > piece_begin) {
                label.push([lead + piece_begin, lead + piece_end]);
            }
            begin = taken_end;
        }
        return {label, href: [lead + href_begin, lead + line.length], image, tags, meta};
    }

    // Where the address of a line begins, -1 when it has none: at the first file://, http:// or https://
    // of the line's last run with no space in it, something after it. Read in one pass over the line:
    // the pattern that looked for it from every position took over a second on 16 000 `http://` in a row
    function href_begin_from_line(line) {
        const run_begin = run_begin_from_text(line);
        const scheme_match = line.slice(run_begin).match(/file:\/\/|https?:\/\//);
        if (!scheme_match) {
            return -1;
        }
        const href_begin = run_begin + scheme_match.index;
        // A name with a line break in it, one that splitting the text by \n leaves, was never a link line
        if ((href_begin + scheme_match[0].length === line.length) || /[\n\r\u2028\u2029]/.test(line.slice(0, run_begin))) {
            return -1;
        }
        return href_begin;
    }

    // Where the `@name` of a link begins, -1 when it has none: at the last word before the address, `head`
    // with no space at its end, when the word opens with @ and has a name after it
    function image_begin_from_head(head) {
        const run_begin = run_begin_from_text(head);
        return ((head[run_begin] === '@') && (head.length > run_begin + 1)) ? run_begin : -1;
    }

    // Where the last run of `text` with no space in it begins: text.length when it ends with a space
    function run_begin_from_text(text) {
        let out = text.length;
        while ((out > 0) && !/\s/.test(text[out - 1])) {
            --out;
        }
        return out;
    }

    // The name of a link that has none: its address as it is written, in its own letters, without the
    // scheme, a user and password, the query and the # part, and without the lone / of a bare host.
    // A run of %XX is shown as the text it stands for; one that is not text stays as it is written
    function label_from_href(href) {
        const address = href.slice(href.indexOf('://') + '://'.length).split(/[?#]/, 1)[0];
        const path_begin = address.search(/[/\\]/);
        const host_end = (path_begin < 0) ? address.length : path_begin;
        const host = address.slice(address.lastIndexOf('@', host_end) + 1, host_end);
        const path = address.slice(host_end);
        return `${host}${(path === '/') ? '' : path}`.replace(/(?:%[0-9a-fA-F]{2})+/g, escapes_decode);

        // Text is valid UTF-8 with no control character and no line break in it
        function escapes_decode(escapes) {
            let text;
            try {
                text = decodeURIComponent(escapes);
            }
            catch {
                return escapes;
            }
            return /[\p{Cc}\p{Zl}\p{Zp}]/u.test(text) ? escapes : text;
        }
    }

    // The design's own page decides: on navplace.com (the embed's iframe too) its Worker's /icon/;
    // anywhere else (CodePen, localhost) icon.horse, as the Worker refuses other sites, and for a
    // host that is not public a tile made here: its name goes to no outside service
    // In the desktop app the link's first letter goes along: a site Google has no icon for gets a tile of it
    function icon_url_from_domain(domain, letter) {
        if ((typeof window === 'undefined') || window.ElectronApp) {
            return `app://favicon/${domain}?letter=${encodeURIComponent(letter)}`;
        }
        if (self.origin === 'https://navplace.com') {
            return `/icon/${domain}`;
        }
        if (!is_public_domain(domain)) {
            return `data:image/svg+xml,${encodeURIComponent(render_tile_svg(letter))}`;
        }
        return `https://icon.horse/icon/${domain}`;
    }

    // The decision of lib/is_public_domain.js, kept here too: a page loads parse.js alone.
    // lib/is_public_domain.test.js feeds both the same hosts
    function is_public_domain(domain) {
        const name = String(domain ?? '').toLowerCase();
        if ((name.length > 253) || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(name) || /^[\d.]+$/.test(name) || /(^|\.)(localhost|local|internal|lan|home|corp|intranet|private|test|invalid|example|home\.arpa)$/.test(name)) {
            return false;
        }
        try {
            return new URL(`http://${name}/`).hostname === name;
        }
        catch {
            return false;
        }
    }

    // navplace's own stand-in, as its Worker draws it (src/cloudflare/serve_icon.mjs): the letter on its green
    function render_tile_svg(letter) {
        const text = (letter || '?').replace(/[&<>"']/g, v => `&#${v.codePointAt(0)};`);
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#286445"/><text x="32" y="43" font-family="system-ui, sans-serif" font-size="32" font-weight="600" fill="#fff" text-anchor="middle">${text}</text></svg>`;
    }
}

// Lower case, Cyrillic letters as Latin ones: what a link's name, tags and address are searched by.
// The search runs what is typed through it too (lib/navplace.js), as parse.text_transliterate
function text_transliterate(text)
{
    const latin_by_cyrillic = {
        'а': 'a',
        'б': 'b',
        'в': 'v',
        'г': 'g',
        'д': 'd',
        'е': 'e',
        'ё': 'yo',
        'ж': 'zh',
        'з': 'z',
        'и': 'i',
        'й': 'y',
        'к': 'k',
        'л': 'l',
        'м': 'm',
        'н': 'n',
        'о': 'o',
        'п': 'p',
        'р': 'r',
        'с': 's',
        'т': 't',
        'у': 'u',
        'ф': 'f',
        'х': 'kh',
        'ц': 'ts',
        'ч': 'ch',
        'ш': 'sh',
        'щ': 'shch',
        'ъ': '',
        'ы': 'y',
        'ь': '',
        'э': 'e',
        'ю': 'yu',
        'я': 'ya',
    };
    // ъ and ь have no Latin letter and leave nothing: Письма is pisma
    return text.toLowerCase().split('').map(v => latin_by_cyrillic[v] ?? v).join('');
}

parse.text_transliterate = text_transliterate;

if (typeof module !== 'undefined') {
    module.exports = parse;
}
