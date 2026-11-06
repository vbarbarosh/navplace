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

    function text_transliterate(text) {
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
        return text.toLowerCase().split('').map(v => latin_by_cyrillic[v] || v).join('');
    }

    function text_squeeze_spaces(text) {
        return text.trim().replace(/\s+/g, ' ');
    }

    function namespaces_from_lines(lines) {
        return lines.map(v => v.replace(/^#+/, '').trim()).join(' ').split('|').map(text_squeeze_spaces).filter(Boolean);
    }

    function directive_from_line(line) {
        // % key: value
        const meta_match = line.match(/^%\s*([^:]+)\s*:\s*(.+)$/);
        if (!meta_match) {
            throw new Error(`Invalid meta line: ${line}`);
        }

        const key = text_squeeze_spaces(meta_match[1]);
        const value = meta_match[2].trim();
        if (key === 'ns') {
            return {ns: value.split('|').map(text_squeeze_spaces).filter(Boolean)};
        }
        else if (key === 'include') {
            return {include: [value]};
        }
        else if (/^picture\s/.test(key)) {
            // % picture kimi: https://… or data:image/…
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
        const href_match = line.match(/^(.*?)(file:\/\/\S+|https?:\/\/\S+)$/);
        if (!href_match) {
            return null;
        }

        let head = href_match[1].trim();

        const href = href_match[2];

        let image_url = null;
        // `@name` right before the url, after the label or opening a line that has none
        head = head.replace(/(?:^|\s+)(@\S+)\s*$/, image_take).trim();

        const line_tags = [];
        const meta = {};
        head = head.replace(/#([a-zA-Z0-9_-]+)(?:=([^\s#]+))?/g, tag_take).trim();

        const tags = [...line_tags, ...common_tags];

        const url = new URL(href);
        const domain = url.host;
        const plain_label = head || ((url.pathname && (url.pathname !== '/')) ? `${domain}${url.pathname}` : domain);
        const label = [prefix, plain_label, suffix].filter(Boolean).join(' ');

        return {
            label,
            href,
            // The design's own page decides: on navplace.com (the embed's iframe too) its Worker's /icon/;
            // anywhere else (CodePen, localhost) icon.horse, as the Worker refuses other sites
            icon_url: ((typeof window === 'undefined') || window.ElectronApp) ? `app://favicon/${domain}` : ((self.origin === 'https://navplace.com') ? `/icon/${domain}` : `https://icon.horse/icon/${domain}`),
            image_url,
            tags,
            meta,
            search1: text_transliterate([label, ...tags].join(' ')),
            search2: text_transliterate(href),
            namespaces,
        };

        function image_take(_, img) {
            image_url = `private://${img.slice(1)}`;
            return '';
        }

        function tag_take(_, key, value) {
            if (value === undefined) {
                line_tags.push(key);
            }
            else {
                meta[key] = value;
            }
            return '';
        }
    }

    // Columns [begin, end) in the raw line, found the way item_from_line finds the parts:
    // {label: [[begin, end], …], href: [begin, end], image: [begin, end] | null, tags: [{name, at}], meta: [{key, value, at}]}
    function item_spans_from_line(line, lead) {
        const href_match = line.match(/^(.*?)(file:\/\/\S+|https?:\/\/\S+)$/);
        const href_begin = href_match[1].length;

        let head_end = href_match[1].trimEnd().length;
        let image = null;

        const image_match = line.slice(0, head_end).match(/(?:^|\s+)(@\S+)\s*$/);
        if (image_match) {
            const image_begin = image_match.index + image_match[0].indexOf('@');
            image = [lead + image_begin, lead + image_begin + image_match[1].length];
            head_end = image_match.index;
        }
        const tags = [];
        const meta = [];
        const taken = [];
        const head = line.slice(0, head_end);
        for (const tag_match of head.matchAll(/#([a-zA-Z0-9_-]+)(?:=([^\s#]+))?/g)) {
            const at = [lead + tag_match.index, lead + tag_match.index + tag_match[0].length];
            taken.push([tag_match.index, tag_match.index + tag_match[0].length]);
            if (tag_match[2] === undefined) {
                tags.push({name: tag_match[1], at});
            }
            else {
                meta.push({key: tag_match[1], value: tag_match[2], at});
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
}

if (typeof module !== 'undefined') {
    module.exports = parse;
}
