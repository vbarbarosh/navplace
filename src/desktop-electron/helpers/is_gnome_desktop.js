// Whether the desktop is GNOME, by XDG_CURRENT_DESKTOP: a list of names with colons between,
// the desktop's own first and those it builds on after it. A desktop built on GNOME keeps
// GNOME's shortcuts and is one too. No name at all, as in a bare session, is not GNOME.
//
//     ubuntu:GNOME   →   true
//     KDE            →   false
function is_gnome_desktop(text)
{
    return (text ?? '').split(':').some(v => v.trim().toLowerCase() === 'gnome');
}

module.exports = is_gnome_desktop;
