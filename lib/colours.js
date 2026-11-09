// The coloured layers of the Playground and the desktop app's settings: each returns HTML for a <pre> drawn under a
// transparent textarea, line for line, so the caret and the colours stay aligned.
// The docs and the main page colour their examples with the same functions.

// The links text: label, #tag, #key=value, @picture, link, % and # lines; `current_line` is
// the 1-based line the cursor is on; `note_by_line`, when given, a Map of the lines % ns leaves
// out of items to the note drawn after each ('' for none). A line parse() skips is
// underlined in orange, why after it
function render_links_html(text, current_line, note_by_line)
{
    const lines = text.split('\n');
    const html_lines = [];
    for (let i = 0, end = lines.length; i < end; ++i) {
        let html = render_links_line_html(lines[i]);

        const skip_note = skip_note_from_line(lines[i]);
        if (skip_note) {
            html = `<span class="c-warn">${html}</span><span class="c-warn-note">  ⚠ ${html_escape(skip_note)}</span>`;
        }
        const note = note_by_line?.get(i + 1);
        if (note !== undefined) {
            const note_html = note ? `<span class="c-note">${html_escape(note)}</span>` : '';
            html = `<span class="c-left-out">${html}</span>${note_html}`;
        }
        html_lines.push((i + 1 === current_line) ? `<span class="c-current">${html || ' '}</span>` : html);
    }
    return `${html_lines.join('\n')}\n`;
}

function render_links_line_html(raw)
{
    const line = raw.trim();
    if (!line) {
        return html_escape(raw);
    }
    if (line[0] === '%') {
        const directive_match = raw.match(/^(\s*%\s*)([^:]+?)(\s*:\s*)(.+)$/);
        if (!directive_match) {
            return `<span class="c-error">${html_escape(raw)}</span>`;
        }
        return `<span class="c-directive">${html_escape(directive_match[1])}</span><span class="c-key">${html_escape(directive_match[2])}</span>${html_escape(directive_match[3])}<span class="c-value">${html_escape(directive_match[4])}</span>`;
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

// One object as JSON; `locked` keys come after a rule, greyed: parse() works them out.
// The whole text is escaped first, then coloured: what is typed there and is not JSON stays text
function render_json_html(text)
{
    const html = html_escape(text).replace(/("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)|([{}[\],])/g, function (all, string, colon, word, number, mark) {
        if (string && colon) {
            return `<span class="c-key">${string}</span>${colon}`;
        }
        if (string) {
            return `<span class="c-value">${string}</span>`;
        }
        if (word) {
            return `<span class="c-word">${word}</span>`;
        }
        if (number) {
            return `<span class="c-number">${number}</span>`;
        }
        return `<span class="c-mark">${mark}</span>`;
    });
    return `${html}\n`;
}

// HTML, CSS and JS in one file: tags, attributes, strings, comments and a few keywords
function render_code_html(text)
{
    let start = 0;

    const re = /(<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|(?<![:"'\w\\])\/\/[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|(<\/?[a-zA-Z][\w-]*|\/?>)|(\s[:@]?[a-zA-Z_][\w.:-]*(?==))|\b(const|let|var|function|return|if|else|for|of|in|new|this|await|async|true|false|null|undefined|class|import|export)\b/g;
    const html_parts = [];
    for (const token of text.matchAll(re)) {
        html_parts.push(html_escape(text.slice(start, token.index)));
        let kind = 'c-word';
        if (token[1]) {
            kind = 'c-comment';
        }
        else if (token[2]) {
            kind = 'c-value';
        }
        else if (token[3]) {
            kind = 'c-tagname';
        }
        else if (token[4]) {
            kind = 'c-key';
        }
        html_parts.push(`<span class="${kind}">${html_escape(token[0])}</span>`);
        start = token.index + token[0].length;
    }
    html_parts.push(html_escape(text.slice(start)));
    return `${html_parts.join('')}\n`;
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
    const command = (comment_at < 0) ? line : line.slice(0, comment_at);
    const comment = (comment_at < 0) ? '' : line.slice(comment_at);
    const html = command.replace(/('[^']*'|"[^"]*")|(\s--?[\w-]+)|(^\s*[^\s=]+)|([^'"\s]+|\s+)/g, function (all, string, flag, program, other) {
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
    return comment ? `${html}<span class="c-comment">${html_escape(comment)}</span>` : html;
}

// key: value
function render_settings_line_html(line)
{
    const setting_match = line.match(/^(\s*)([\w.-]+)(:\s*)(.*)$/);
    if (!setting_match) {
        return html_escape(line);
    }
    return `${setting_match[1]}<span class="c-key">${html_escape(setting_match[2])}</span>${html_escape(setting_match[3])}<span class="c-value">${html_escape(setting_match[4])}</span>`;
}

// The embed snippet: its HTML as code, the links inside data-links="…" as links.txt
function render_embed_html(text)
{
    const embed_match = text.match(/^([\s\S]*?data-links=")([\s\S]*?)("[\s\S]*)$/);
    if (!embed_match) {
        return render_code_html(text).replace(/\n$/, '');
    }
    const head_html = render_code_html(embed_match[1]).replace(/\n$/, '');
    const links_html = render_links_html(embed_match[2], 0).replace(/\n$/, '');
    const tail_html = render_code_html(embed_match[3]).replace(/\n$/, '');
    return `${head_html}${links_html}${tail_html}`;
}

// Wraps the [begin, end) parts of a line in their spans, in the order they stand
function render_parts_html(raw, parts)
{
    let start = 0;

    const html_parts = [];
    for (const part of [...parts].sort((a, b) => a.at[0] - b.at[0])) {
        html_parts.push(html_escape(raw.slice(start, part.at[0])));
        html_parts.push(`<span class="${part.kind}">${html_escape(raw.slice(part.at[0], part.at[1]))}</span>`);
        start = part.at[1];
    }
    html_parts.push(html_escape(raw.slice(start)));
    return html_parts.join('');
}

// Why parse() skips this line, in a few words; '' when it does not
function skip_note_from_line(raw)
{
    const message = parse(raw).warnings?.[0]?.message;
    if (!message) {
        return '';
    }
    if (message.startsWith('Invalid picture line')) {
        return 'skipped: not an https or data url';
    }
    if (message.startsWith('Invalid meta line')) {
        return 'skipped: no key: value';
    }
    return 'skipped: bad url';
}

function html_escape(text)
{
    return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
