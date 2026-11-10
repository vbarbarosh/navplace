// Two versions compared as a.localeCompare(b) would, by their numbers: 1.10.0 after 1.9.0. What
// follows a plus sign says which build it is and takes no part: a build of master,
// 1.4.2+master.20261110.abc1234, is 1.4.2 to a check for updates.
//
//     1.4.3 against 1.4.2+master.20261110.abc1234   →   1
function version_compare(a, b)
{
    const pa = a.split('+')[0].split('.').map(Number);
    const pb = b.split('+')[0].split('.').map(Number);
    for (let i = 0; i < 3; ++i) {
        if ((pa[i] ?? 0) !== (pb[i] ?? 0)) {
            return ((pa[i] ?? 0) > (pb[i] ?? 0)) ? 1 : -1;
        }
    }
    return 0;
}

module.exports = version_compare;
