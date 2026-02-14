/**
 * Scoring utilities for game score calculation
 * Mirrors the backend calculation logic exactly
 */

export const DEFAULT_SCORING_RULES = {
    base_points_per_phrase: 100,
    completion_bonus_points: 200,
    difficulty_multipliers: {
        very_easy: 0.9,
        easy: 1.0,
        medium: 1.2,
        hard: 1.5,
        very_hard: 2.0,
    },
    hint_penalty_per_hint: 75,
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
 * Client-side score calculation for anonymous users
 * Mirrors the backend calculation logic exactly
 * 
 * @param {string} difficulty - Game difficulty level
 * @param {number} phrasesFound - Number of phrases found
 * @param {number} totalPhrases - Total number of phrases in the game
 * @param {number} durationSeconds - Time taken in seconds
 * @param {number} hintsUsed - Number of hints used
 * @param {Object} rules - Scoring rules object (optional, defaults to DEFAULT_SCORING_RULES)
 * @returns {Object} Score breakdown with base_score, difficulty_bonus, time_bonus, etc.
 */
export function calculateScoreClientSide(
    difficulty,
    phrasesFound,
    totalPhrases,
    durationSeconds,
    hintsUsed,
    rules = DEFAULT_SCORING_RULES
) {
    const scoringRules = rules || DEFAULT_SCORING_RULES;

    // Base score: constant points per phrase found
    const baseScore = phrasesFound * scoringRules.base_points_per_phrase;

    // Difficulty multipliers determine the size of the bonus
    const difficultyMultiplier =
        scoringRules.difficulty_multipliers[difficulty] ||
        scoringRules.difficulty_multipliers.easy;
    const difficultyBonus = Math.floor(baseScore * (difficultyMultiplier - 1.0));

    // Time bonus (faster completion = higher bonus)
    let timeBonus = 0;
    if (phrasesFound === totalPhrases && durationSeconds > 0) {
        const targetTime =
            scoringRules.time_bonus.target_times_seconds[difficulty] ||
            scoringRules.time_bonus.target_times_seconds.medium;
        if (targetTime > 0 && durationSeconds <= targetTime) {
            const timeRatio = Math.max(
                0.0,
                (targetTime - durationSeconds) / targetTime
            );
            timeBonus = Math.floor(
                baseScore * scoringRules.time_bonus.max_ratio * timeRatio
            );
        }
    }

    // Completion bonus for finding all phrases
    const streakBonus =
        phrasesFound === totalPhrases ? scoringRules.completion_bonus_points : 0;

    // Hint penalty: fixed deduction per hint used
    const hintPenalty = hintsUsed * scoringRules.hint_penalty_per_hint;

    // Calculate final score
    const finalScore = Math.max(
        0,
        baseScore + difficultyBonus + timeBonus + streakBonus - hintPenalty
    );

    return {
        base_score: baseScore,
        difficulty_bonus: difficultyBonus,
        time_bonus: timeBonus,
        streak_bonus: streakBonus,
        hint_penalty: hintPenalty,
        final_score: finalScore,
        hints_used: hintsUsed,
        hint_penalty_per_hint: scoringRules.hint_penalty_per_hint,
    };
}
