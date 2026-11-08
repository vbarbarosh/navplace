// A design's light/dark theme, one switch for every design (rules UI-01..UI-04): loaded in <head>
// with <script src="/lib/theme_switch.js"></script>, before the design's own CSS paints.
//
// - The theme is set on <html> as data-theme="light" | "dark" before the page shows: the choice saved
//   in localStorage, or the OS setting when nothing is saved yet. A design's colours live on :root,
//   its dark ones on :root[data-theme="dark"].
// - One button shows the current theme, a sun for light and a crescent for dark; a click turns it to
//   the other one and saves it. It goes into the design's [data-theme-switch] element, or, when the
//   design has none, sits at the page's top right corner.
// - Scrollbars are thin and take --np-scrollbar-thumb and --np-scrollbar-track from the design.
(function () {
    const STORAGE_KEY = 'navplace.design.theme';
    const SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12,9c1.65,0,3,1.35,3,3s-1.35,3-3,3s-3-1.35-3-3S10.35,9,12,9 M12,7c-2.76,0-5,2.24-5,5s2.24,5,5,5s5-2.24,5-5 S14.76,7,12,7L12,7z M2,13l2,0c0.55,0,1-0.45,1-1s-0.45-1-1-1l-2,0c-0.55,0-1,0.45-1,1S1.45,13,2,13z M20,13l2,0c0.55,0,1-0.45,1-1 s-0.45-1-1-1l-2,0c-0.55,0-1,0.45-1,1S19.45,13,20,13z M11,2v2c0,0.55,0.45,1,1,1s1-0.45,1-1V2c0-0.55-0.45-1-1-1S11,1.45,11,2z M11,20v2c0,0.55,0.45,1,1,1s1-0.45,1-1v-2c0-0.55-0.45-1-1-1C11.45,19,11,19.45,11,20z M5.99,4.58c-0.39-0.39-1.03-0.39-1.41,0 c-0.39,0.39-0.39,1.03,0,1.41l1.06,1.06c0.39,0.39,1.03,0.39,1.41,0s0.39-1.03,0-1.41L5.99,4.58z M18.36,16.95 c-0.39-0.39-1.03-0.39-1.41,0c-0.39,0.39-0.39,1.03,0,1.41l1.06,1.06c0.39,0.39,1.03,0.39,1.41,0c0.39-0.39,0.39-1.03,0-1.41 L18.36,16.95z M19.42,5.99c0.39-0.39,0.39-1.03,0-1.41c-0.39-0.39-1.03-0.39-1.41,0l-1.06,1.06c-0.39,0.39-0.39,1.03,0,1.41 s1.03,0.39,1.41,0L19.42,5.99z M7.05,18.36c0.39-0.39,0.39-1.03,0-1.41c-0.39-0.39-1.03-0.39-1.41,0l-1.06,1.06 c-0.39,0.39-0.39,1.03,0,1.41s1.03,0.39,1.41,0L7.05,18.36z"/></svg>';
    const MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9.37,5.51C9.19,6.15,9.1,6.82,9.1,7.5c0,4.08,3.32,7.4,7.4,7.4c0.68,0,1.35-0.09,1.99-0.27C17.45,17.19,14.93,19,12,19 c-3.86,0-7-3.14-7-7C5,9.07,6.81,6.55,9.37,5.51z M12,3c-4.97,0-9,4.03-9,9s4.03,9,9,9s9-4.03,9-9c0-0.46-0.04-0.92-0.1-1.36 c-0.98,1.37-2.58,2.26-4.4,2.26c-2.98,0-5.4-2.42-5.4-5.4c0-1.81,0.89-3.42,2.26-4.4C12.92,3.04,12.46,3,12,3L12,3z"/></svg>';
    // Before the design's own styles, so a design restyles the button and the scrollbars as it likes
    const STYLE = `
:root {
    scrollbar-width: thin;
    scrollbar-color: var(--np-scrollbar-thumb, rgba(128, 128, 128, 0.55)) var(--np-scrollbar-track, transparent);
}
.np-theme-switch {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--np-switch-border, rgba(128, 128, 128, 0.35));
    border-radius: 50%;
    background: var(--np-switch-bg, rgba(255, 255, 255, 0.75));
    color: var(--np-switch-fg, #1c1917);
    cursor: pointer;
}
:root[data-theme="dark"] .np-theme-switch {
    background: var(--np-switch-bg, rgba(24, 24, 27, 0.75));
    color: var(--np-switch-fg, #f4f4f5);
}
.np-theme-switch:hover {
    border-color: currentColor;
}
.np-theme-switch svg {
    width: 18px;
    height: 18px;
}
.np-theme-switch-corner {
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 1000;
}`;

    theme_apply(theme_load());
    document.head.insertAdjacentHTML('afterbegin', `<style data-np-theme-switch>${STYLE}</style>`);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', switch_mount);
    }
    else {
        switch_mount();
    }
    // Another design, or another tab, changed it
    window.addEventListener('storage', function (event) {
        if ((event.key === STORAGE_KEY) && ((event.newValue === 'light') || (event.newValue === 'dark'))) {
            theme_apply(event.newValue);
        }
    });

    function switch_mount() {
        const place = document.querySelector('[data-theme-switch]');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = place ? 'np-theme-switch' : 'np-theme-switch np-theme-switch-corner';
        button.addEventListener('click', function () {
            const theme = (document.documentElement.dataset.theme === 'dark') ? 'light' : 'dark';
            theme_apply(theme);
            theme_save(theme);
        });
        (place ?? document.body).append(button);
        switch_render();
    }

    function switch_render() {
        const dark = (document.documentElement.dataset.theme === 'dark');
        for (const button of document.querySelectorAll('.np-theme-switch')) {
            button.innerHTML = dark ? MOON : SUN;
            button.title = dark ? 'Dark theme: switch to light' : 'Light theme: switch to dark';
            button.setAttribute('aria-label', button.title);
        }
    }

    function theme_apply(theme) {
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
        switch_render();
    }

    function theme_load() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if ((saved === 'light') || (saved === 'dark')) {
                return saved;
            }
        }
        catch {
        }
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function theme_save(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        }
        catch {
        }
    }
})();
