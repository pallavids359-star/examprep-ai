const VALID_OPTIONS = ["A", "B", "C", "D"];

// true if both arrays contain exactly the same letters
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Marks every answer in the attempt and returns the result summary.
 * attempt        : the TestAttempt document (its answers get updated)
 * submitted      : what the student sent [{ questionId, selectedOptionIds, numericalValue, timeSpentSec }]
 * questionsById  : Map of questionId -> Question (with answers loaded)
 */
const scoreAttempt = (attempt, submitted, questionsById) => {
    const scheme = attempt.markingScheme;
    const givenById = new Map((submitted || []).map((a) => [String(a.questionId), a]));

    let score = 0;
    let maxScore = 0;
    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;
    let totalTime = 0;
    const subjects = new Map();
    const chapters = new Map();

    for (const answer of attempt.answers) {
        const question = questionsById.get(String(answer.questionId));
        const given = givenById.get(String(answer.questionId)) || {};

        // A question can override the exam's marks
        const plus = question?.marks?.correct ?? scheme.correct;
        const minus = question?.marks?.incorrect ?? scheme.incorrect;
        maxScore += plus;

        // Clean up what the student sent: only A-D, no duplicates
        const selected = [
            ...new Set((given.selectedOptionIds || []).filter((id) => VALID_OPTIONS.includes(id))),
        ].sort();

        answer.selectedOptionIds = selected;
        answer.numericalValue =
            typeof given.numericalValue === "number" ? given.numericalValue : undefined;
        answer.timeSpentSec = Math.max(0, Number(given.timeSpentSec) || 0);
        answer.markedForReview = Boolean(given.markedForReview);
        answer.visited = Boolean(answer.visited || given.visited || answer.timeSpentSec > 0 || selected.length || typeof given.numericalValue === "number");
        totalTime += answer.timeSpentSec;

        // Decide: correct (true), wrong (false) or unanswered (null)
        let isCorrect = null;
        if (!question) {
            isCorrect = null; // question was removed: count as unanswered
        } else if (question.type === "numerical") {
            answer.correctOptionIds = [];
            const correctValue = question.numericalAnswer?.value;
            if (answer.numericalValue !== undefined && typeof correctValue === "number") {
                // A tiny extra margin so 0.1 + 0.2 style rounding never marks a right answer wrong
                const tolerance = (question.numericalAnswer.tolerance || 0) + 1e-9;
                isCorrect = Math.abs(answer.numericalValue - correctValue) <= tolerance;
            }
        } else {
            answer.correctOptionIds = [...question.correctOptionIds].sort();
            if (selected.length > 0) isCorrect = sameSet(selected, answer.correctOptionIds);
        }

        answer.isCorrect = isCorrect;
        answer.marksAwarded = isCorrect === null ? scheme.unanswered : isCorrect ? plus : minus;
        score += answer.marksAwarded;

        if (isCorrect === null) unanswered++;
        else if (isCorrect) correct++;
        else incorrect++;

        // Per-subject totals
        const sKey = String(answer.subjectId);
        const s = subjects.get(sKey) || {
            subjectId: answer.subjectId,
            score: 0,
            correct: 0,
            incorrect: 0,
            unanswered: 0,
        };
        s.score += answer.marksAwarded;
        if (isCorrect === null) s.unanswered++;
        else if (isCorrect) s.correct++;
        else s.incorrect++;
        subjects.set(sKey, s);

        // Per-chapter totals
        const cKey = String(answer.chapterId);
        const c = chapters.get(cKey) || { chapterId: answer.chapterId, correct: 0, attempted: 0 };
        if (isCorrect !== null) c.attempted++;
        if (isCorrect) c.correct++;
        chapters.set(cKey, c);
    }

    const attempted = correct + incorrect;
    const elapsedSec = Math.round((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);

    return {
        score,
        maxScore,
        percentage: maxScore ? round2((score / maxScore) * 100) : 0,
        accuracy: attempted ? round2((correct / attempted) * 100) : 0,
        correct,
        incorrect,
        unanswered,
        timeTakenSec: totalTime || elapsedSec,
        subjectBreakdown: [...subjects.values()],
        chapterBreakdown: [...chapters.values()],
    };
};

module.exports = scoreAttempt;