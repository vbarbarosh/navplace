// The text of a .desktop file with `exec` as the value of its Exec line and every other line as
// it is; a text with no Exec line comes back unchanged
function desktop_entry_exec_set(text, exec)
{
    return text.replace(/^Exec=.*$/m, () => `Exec=${exec}`);
}

module.exports = desktop_entry_exec_set;
