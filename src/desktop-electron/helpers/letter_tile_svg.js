// The icon of a site Google has none for: the link's first letter, white, on a colour that is the
// same for every link of that site
const COLOURS = ['#7c3aed', '#0f766e', '#c2410c', '#1d4ed8', '#be185d', '#15803d', '#a16207', '#4338ca'];

function letter_tile_svg(letter, domain)
{
    let hash = 0;
    for (const c of String(domain)) {
        hash = ((hash*31) + c.codePointAt(0)) >>> 0;
    }
    const colour = COLOURS[hash % COLOURS.length];
    const text = String(letter || '?').slice(0, 1).toUpperCase().replace(/[&<>"']/g, v => `&#${v.codePointAt(0)};`);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><rect width="64" height="64" rx="14" fill="${colour}"/><text x="32" y="44" fill="#ffffff" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="34" font-weight="700" text-anchor="middle">${text}</text></svg>`;
}

module.exports = letter_tile_svg;
