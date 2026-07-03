/**
 * Offline fallback scoring helpers.
 *
 * The backend is the single source of truth for scores: previews come from
 * `/system/calculate-score` (a public endpoint) and the authoritative saved score
 * comes from `/game/score`. These helpers exist ONLY as a last-resort fallback for
 * when the scoring API is unreachable, so they are intentionally minimal and must
 * not re-implement the full backend formula.
 */

// Minimal rules used only for offline display fallbacks. Values mirror the backend
// defaults; the backend remains the source of truth if the two ever diverge.
export const FALLBACK_SCORING_RULES = {
    base_points_per_phrase: 100,
    completion_bonus_points: 200,
    difficulty_multipliers: {
        very_easy: 0.8,
        easy: 1.0,
        medium: 1.2,
        hard: 1.5,
        very_hard: 2.0,
    },
    hint_penalty_per_hint: 0,
    time_bonus: {
        max_ratio: 0.3,
        target_times_seconds: {
            very_easy: 240,
            easy: 300,
            medium: 600,
            hard: 900,
            very_hard: 1200,
        },
    },
};

/**
 * Last-resort offline score estimate, used only when the scoring API is
 * unreachable. Deliberately simplified (base points × difficulty + completion
 * bonus, no time bonus) — the backend is the single source of truth for real
 * scores, and this is a degraded preview only.
 *
 * @param {string} difficulty - Game difficulty level
 * @param {number} phrasesFound - Number of phrases found
 * @param {number} totalPhrases - Total number of phrases in the game
 * @param {number} hintsUsed - Number of hints used
 * @param {Object} [rules] - Scoring rules (defaults to FALLBACK_SCORING_RULES)
 * @returns {Object} Score breakdown matching the backend response shape
 */
export function estimateScoreOffline(difficulty, phrasesFound, totalPhrases, hintsUsed, rules = FALLBACK_SCORING_RULES) {
    const r = rules || FALLBACK_SCORING_RULES;
    const baseScore = phrasesFound * r.base_points_per_phrase;
    const multiplier = r.difficulty_multipliers[difficulty] ?? r.difficulty_multipliers.easy;
    const difficultyBonus = Math.floor(baseScore * (multiplier - 1.0));
    const completionBonus = phrasesFound === totalPhrases ? r.completion_bonus_points : 0;
    const hintPenalty = hintsUsed * r.hint_penalty_per_hint;
    const finalScore = Math.max(0, baseScore + difficultyBonus + completionBonus - hintPenalty);

    return {
        base_score: baseScore,
        difficulty_bonus: difficultyBonus,
        time_bonus: 0,
        completion_bonus: completionBonus,
        hint_penalty: hintPenalty,
        final_score: finalScore,
        hints_used: hintsUsed,
        hint_penalty_per_hint: r.hint_penalty_per_hint,
    };
}
