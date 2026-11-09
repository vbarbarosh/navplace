// A gate for answers that may come back out of order. Calls are numbered as they begin; an answer
// passes only when no newer call's answer has passed before it, so what is shown never goes back.
// An older answer that comes first still passes: calls that begin faster than they end cannot
// keep every answer out.
//
//     const pass = gate.enter();   // a call begins
//     pass.is_newest()             // no call has begun since
//     pass.leave()                 // true: use the answer; false: a newer one is in use already
function make_newest_gate()
{
    let entered = 0;
    let left = 0;

    return {
        enter: function () {
            const number = ++entered;
            return {
                number,
                is_newest: function () {
                    return number === entered;
                },
                leave: function () {
                    if (number < left) {
                        return false;
                    }
                    left = number;
                    return true;
                },
            };
        },
    };
}

module.exports = make_newest_gate;
