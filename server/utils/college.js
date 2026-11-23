// One spelling for the main college: "MB PU", "mb pu", "Mbpu" ... all become "MBPU"
const MAIN_COLLEGE = "MBPU";
const normalizeCollege = (name) => {
    const clean = String(name || "").trim().replace(/\s+/g, " ").slice(0, 120);
    return clean.replace(/\s/g, "").toLowerCase() === "mbpu" ? MAIN_COLLEGE : clean;
};
const sameCollege = (a, b) => normalizeCollege(a).toLowerCase() === normalizeCollege(b).toLowerCase();
// College list for dropdowns: MBPU first, every spelling merged, no repeats
const collegeList = (names) => {
    const out = [MAIN_COLLEGE];
    for (const n of names || []) {
        const c = normalizeCollege(n);
        if (c && !out.some((x) => x.toLowerCase() === c.toLowerCase())) out.push(c);
    }
    return out;
};
// Mongo filter matching a college however it was spelled ("MBPU" also finds old "MB PU")
const collegeFilter = (name) => {
    const c = normalizeCollege(name);
    if (c === MAIN_COLLEGE) return /^\s*mb\s*pu\s*$/i;
    return new RegExp(`^${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
};
module.exports = { MAIN_COLLEGE, normalizeCollege, sameCollege, collegeList, collegeFilter };
