// The design a name leads to: the name itself, or `classic` for a name that is gone. `first` was
// renamed to `classic`, `basic` was the same design, and six were themes of it; a links file or
// an address that still names one of them shows `classic`, the same look or the nearest.
//
//     basic            →   classic
//     basic-for-kids   →   classic
//     cards            →   cards
const DESIGNS_GONE = ['basic', 'basic-for-internal2', 'basic-for-internal3-with-groups', 'basic-for-kids', 'basic-for-kids2', 'basic-for-portfolio', 'basic-for-recipes', 'first'];

function design_from_name(name)
{
    return DESIGNS_GONE.includes(name) ? 'classic' : name;
}

module.exports = design_from_name;
