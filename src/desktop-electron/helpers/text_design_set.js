// The links text with `% design: <design>` in place of the `% design:` line the parser obeys, or
// as a first line when it has none. Of several such lines the parser obeys the last (lib/parse.js):
// that is the one the choice is written to, and the lines before it stay as they are.
//
//     % design: cards\n% design: github   and palette   →   % design: cards\n% design: palette
function text_design_set(text, design)
{
    const line = `% design: ${design}`;
    const found = Array.from(text.matchAll(/^[ \t]*%[ \t]*design[ \t]*:.*$/gm)).at(-1);
    if (!found) {
        return `${line}\n${text}`;
    }
    return `${text.slice(0, found.index)}${line}${text.slice(found.index + found[0].length)}`;
}

module.exports = text_design_set;
