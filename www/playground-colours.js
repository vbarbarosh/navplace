// The Playground's coloured layers: each returns HTML for a <pre> drawn under a
// transparent textarea, line for line, so the caret and the colours stay aligned.
// The docs and the main page colour their examples with the same functions.

// The links text: label, #tag, #key=value, @picture, link, % and # lines; `current` is
// the 1-based line the cursor is on
function render_links_html(text, current)
{
    const lines = text.split('\n');
    const out = [];
    for (let i = 0, end = lines.length; i < end; ++i) {
        const html = render_links_line_html(lines[i]);
        out.push((i + 1 === current) ? `<span class="c-current">${html || ' '}</span>` : html);
    }
    return `${out.join('\n')}\n`;
}

function render_links_line_html(raw)
{
    const line = raw.trim();
    if (!line) {
        return html_escape(raw);
    }
    if (line[0] === '%') {
        const m = raw.match(/^(\s*%\s*)([^:]+?)(\s*:\s*)(.+)$/);
        if (!m) {
            return `<span class="c-error">${html_escape(raw)}</span>`;
        }
        return `<span class="c-directive">${html_escape(m[1])}</span><span class="c-key">${html_escape(m[2])}</span>${html_escape(m[3])}<span class="c-value">${html_escape(m[4])}</span>`;
    }
    if (line[0] === '#') {
        return `<span class="c-section">${html_escape(raw)}</span>`;
    }
    let item;
    try {
        item = parse(raw, {spans: true}).items[0];
    }
    catch {
        return `<span class="c-error">${html_escape(raw)}</span>`;
    }
    if (!item) {
        return `<span class="c-ignored">${html_escape(raw)}</span>`;
    }
    const parts = [
        ...item.spans.tags.map(v => ({at: v.at, kind: 'c-tag'})),
        ...item.spans.meta.map(v => ({at: v.at, kind: 'c-tag'})),
        {at: item.spans.href, kind: 'c-url'},
    ];
    if (item.spans.image) {
        parts.push({at: item.spans.image, kind: 'c-image'});
    }
    return render_parts_html(raw, parts);
}

// One object as JSON; `locked` keys come after a rule, greyed: parse() works them out
function render_json_html(text)
{
    const out = text.replace(/("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)|([{}[\],])/g, function (all, string, colon, word, number, mark) {
        if (string && colon) {
            return `<span class="c-key">${html_escape(string)}</span>${colon}`;
        }
        if (string) {
            return `<span class="c-value">${html_escape(string)}</span>`;
        }
        if (word) {
            return `<span class="c-word">${word}</span>`;
        }
        if (number) {
            return `<span class="c-number">${number}</span>`;
        }
        return `<span class="c-mark">${html_escape(mark)}</span>`;
    });
    return `${out}\n`;
}

// HTML, CSS and JS in one file: tags, attributes, strings, comments and a few keywords
function render_code_html(text)
{
    const re = /(<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|(?<![:"'\w\\])\/\/[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|(<\/?[a-zA-Z][\w-]*|\/?>)|(\s[:@]?[a-zA-Z_][\w.:-]*(?==))|\b(const|let|var|function|return|if|else|for|of|in|new|this|await|async|true|false|null|undefined|class|import|export)\b/g;
    const out = [];
    let start = 0;
    for (const m of text.matchAll(re)) {
        out.push(html_escape(text.slice(start, m.index)));
        const kind = m[1] ? 'c-comment' : m[2] ? 'c-value' : m[3] ? 'c-tagname' : m[4] ? 'c-key' : 'c-word';
        out.push(`<span class="${kind}">${html_escape(m[0])}</span>`);
        start = m.index + m[0].length;
    }
    out.push(html_escape(text.slice(start)));
    return `${out.join('')}\n`;
}

// An example on the docs or the main page in colour, by its kind: the Playground's colours
function render_example_html(text, lang)
{
    switch (lang) {
    case 'links':
        return render_links_html(text, 0).replace(/\n$/, '');
    case 'code':
        return render_code_html(text).replace(/\n$/, '');
    case 'json':
        return render_json_html(text).replace(/\n$/, '');
    case 'embed':
        return render_embed_html(text);
    case 'shell':
        return text.split('\n').map(render_shell_line_html).join('\n');
    case 'settings':
        return text.split('\n').map(render_settings_line_html).join('\n');
    }
    return html_escape(text);
}

// A command grey after its #, the program in colour, its flags and quoted strings too
function render_shell_line_html(line)
{
    const comment_at = line.search(/(^|\s)#/);
    const command = comment_at < 0 ? line : line.slice(0, comment_at);
    const comment = comment_at < 0 ? '' : line.slice(comment_at);
    const out = command.replace(/('[^']*'|"[^"]*")|(\s--?[\w-]+)|(^\s*[^\s=]+)|([^'"\s]+|\s+)/g, function (all, string, flag, program, other) {
        if (string) {
            return `<span class="c-value">${html_escape(string)}</span>`;
        }
        if (flag) {
            return `<span class="c-key">${html_escape(flag)}</span>`;
        }
        if (program) {
            return `<span class="c-word">${html_escape(program)}</span>`;
        }
        return html_escape(other);
    });
    return comment ? `${out}<span class="c-comment">${html_escape(comment)}</span>` : out;
}

// key: value
function render_settings_line_html(line)
{
    const m = line.match(/^(\s*)([\w.-]+)(:\s*)(.*)$/);
    if (!m) {
        return html_escape(line);
    }
    return `${m[1]}<span class="c-key">${html_escape(m[2])}</span>${html_escape(m[3])}<span class="c-value">${html_escape(m[4])}</span>`;
}

// The embed snippet: its HTML as code, the links inside data-links="…" as links.txt
function render_embed_html(text)
{
    const m = text.match(/^([\s\S]*?data-links=")([\s\S]*?)("[\s\S]*)$/);
    if (!m) {
        return render_code_html(text).replace(/\n$/, '');
    }
    return render_code_html(m[1]).replace(/\n$/, '') + render_links_html(m[2], 0).replace(/\n$/, '') + render_code_html(m[3]).replace(/\n$/, '');
}

// Wraps the [start, end) parts of a line in their spans, in the order they stand
function render_parts_html(raw, parts)
{
    const out = [];
    let start = 0;
    for (const part of parts.sort((a, b) => a.at[0] - b.at[0])) {
        out.push(html_escape(raw.slice(start, part.at[0])));
        out.push(`<span class="${part.kind}">${html_escape(raw.slice(part.at[0], part.at[1]))}</span>`);
        start = part.at[1];
    }
    out.push(html_escape(raw.slice(start)));
    return out.join('');
}

function html_escape(text)
{
    return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
