// Difficulty as percentages: { easy, medium, hard } adding up to 100.
//   difficulty: "any" | "easy" | "medium" | "hard" | "equal" | "custom"
//   mix (only for "custom"): { easy, medium, hard }
const LEVELS = ["easy", "medium", "hard"];

const userError = (message) => Object.assign(new Error(message), { status: 400 });

// Returns null for "any" or a single level (those keep the old behaviour), else the percentages
const readMix = (difficulty, mix) => {
    if (difficulty === "equal") return { easy: 34, medium: 33, hard: 33 };
    if (difficulty !== "custom") return null;
    const out = {};
    LEVELS.forEach((l) => (out[l] = Math.max(0, Math.min(100, Math.round(Number(mix?.[l]) || 0)))));
    if (out.easy + out.medium + out.hard !== 100) throw userError("Easy + medium + hard must add up to 100%");
    return out;
};

// Share n questions out by the percentages (largest remainders get the leftovers)
const splitCounts = (n, mix) => {
    const raw = LEVELS.map((l) => (n * (mix[l] || 0)) / 100);
    const out = raw.map(Math.floor);
    let left = n - out.reduce((a, b) => a + b, 0);
    raw.map((r, i) => [r - Math.floor(r), i])
        .sort((a, b) => b[0] - a[0] || a[1] - b[1])
        .forEach(([, i]) => {
            if (left > 0 && mix[LEVELS[i]] > 0) {
                out[i] += 1;
                left -= 1;
            }
        });
    return Object.fromEntries(LEVELS.map((l, i) => [l, out[i]]));
};

// Picks n questions following the mix; a level with too few is topped up from any level.
// sampleFn(match, size) must return documents with _id.
const sampleMixed = async (match, n, mix, sampleFn) => {
    const counts = splitCounts(n, mix);
    const picked = [];
    const already = match._id?.$nin || [];
    const not = () => ({ $nin: [...already, ...picked.map((q) => q._id)] });
    for (const l of LEVELS) {
        if (!counts[l]) continue;
        picked.push(...(await sampleFn({ ...match, difficulty: l, _id: not() }, counts[l])));
    }
    if (picked.length < n) picked.push(...(await sampleFn({ ...match, _id: not() }, n - picked.length)));
    return picked;
};

const mixLabel = (mix) => (mix ? `${mix.easy}/${mix.medium}/${mix.hard}` : "");

module.exports = { readMix, splitCounts, sampleMixed, mixLabel, LEVELS };
