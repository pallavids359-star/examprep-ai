// One spelling for the main college: "MB PU", "mb pu", "Mbpu" ... all become "MBPU"
const MAIN_COLLEGE = "MBPU";
const normalizeCollege = (name) => {
    const clean = String(name || "").trim().replace(/\s+/g, " ").slice(0, 120);
    return clean.replace(/\s/g, "").toLowerCase() === "mbpu" ? MAIN_COLLEGE : clean;
};
const sameCollege = (a, b) => normalizeCollege(a).toLowerCase() === normalizeCollege(b).toLowerCase();
module.exports = { MAIN_COLLEGE, normalizeCollege, sameCollege };
