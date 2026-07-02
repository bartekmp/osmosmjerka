import { estimateScoreOffline, FALLBACK_SCORING_RULES } from '../scoringUtils';

describe('scoringUtils (offline fallback)', () => {
    describe('estimateScoreOffline', () => {
        it('should calculate base score correctly', () => {
            const result = estimateScoreOffline('easy', 5, 10, 0);

            expect(result.base_score).toBe(500); // 5 phrases * 100 points
            expect(result.final_score).toBeGreaterThan(0);
        });

        it('should apply difficulty multiplier for very_hard', () => {
            const result = estimateScoreOffline('very_hard', 5, 10, 0);

            // very_hard multiplier is 2.0 -> bonus = 500 * (2.0 - 1.0) = 500
            expect(result.difficulty_bonus).toBe(500);
            expect(result.base_score).toBe(500);
        });

        it('should apply difficulty multiplier for very_easy (matches backend 0.8)', () => {
            const result = estimateScoreOffline('very_easy', 5, 10, 0);

            // very_easy multiplier is 0.8 -> bonus = 500 * (0.8 - 1.0) = -100
            expect(result.difficulty_bonus).toBe(-100);
        });

        it('should award completion bonus when all phrases found', () => {
            const result = estimateScoreOffline('easy', 10, 10, 0);

            expect(result.streak_bonus).toBe(200);
            expect(result.base_score).toBe(1000);
        });

        it('should not award completion bonus when not all phrases found', () => {
            const result = estimateScoreOffline('easy', 5, 10, 0);

            expect(result.streak_bonus).toBe(0);
        });

        it('should not include a time bonus (degraded offline estimate)', () => {
            const result = estimateScoreOffline('easy', 10, 10, 0);

            expect(result.time_bonus).toBe(0);
        });

        it('should not penalize hints by default', () => {
            const result = estimateScoreOffline('easy', 5, 10, 3);

            expect(result.hint_penalty).toBe(0); // default hint penalty is 0
            expect(result.hints_used).toBe(3);
        });

        it('should apply a hint penalty when custom rules set one', () => {
            const customRules = { ...FALLBACK_SCORING_RULES, hint_penalty_per_hint: 100 };
            const result = estimateScoreOffline('easy', 5, 10, 2, customRules);

            expect(result.hint_penalty).toBe(200); // 2 * 100
        });

        it('should not allow negative scores', () => {
            const customRules = { ...FALLBACK_SCORING_RULES, hint_penalty_per_hint: 1000 };
            const result = estimateScoreOffline('very_easy', 1, 10, 10, customRules);

            expect(result.final_score).toBeGreaterThanOrEqual(0);
        });

        it('should use custom base points when provided', () => {
            const customRules = { ...FALLBACK_SCORING_RULES, base_points_per_phrase: 200 };
            const result = estimateScoreOffline('easy', 5, 10, 0, customRules);

            expect(result.base_score).toBe(1000); // 5 * 200
        });

        it('should default to easy difficulty multiplier for unknown difficulty', () => {
            const result = estimateScoreOffline('unknown_difficulty', 5, 10, 0);

            // Falls back to easy multiplier (1.0), so difficulty bonus = 0
            expect(result.difficulty_bonus).toBe(0);
        });

        it('should return all score breakdown components', () => {
            const result = estimateScoreOffline('hard', 7, 10, 2);

            expect(result).toHaveProperty('base_score');
            expect(result).toHaveProperty('difficulty_bonus');
            expect(result).toHaveProperty('time_bonus');
            expect(result).toHaveProperty('streak_bonus');
            expect(result).toHaveProperty('hint_penalty');
            expect(result).toHaveProperty('final_score');
            expect(result).toHaveProperty('hints_used');
            expect(result).toHaveProperty('hint_penalty_per_hint');
        });
    });

    describe('FALLBACK_SCORING_RULES', () => {
        it('should have all required properties', () => {
            expect(FALLBACK_SCORING_RULES).toHaveProperty('base_points_per_phrase');
            expect(FALLBACK_SCORING_RULES).toHaveProperty('completion_bonus_points');
            expect(FALLBACK_SCORING_RULES).toHaveProperty('difficulty_multipliers');
            expect(FALLBACK_SCORING_RULES).toHaveProperty('hint_penalty_per_hint');
            expect(FALLBACK_SCORING_RULES).toHaveProperty('time_bonus');
        });

        it('should not penalize hints by default', () => {
            expect(FALLBACK_SCORING_RULES.hint_penalty_per_hint).toBe(0);
        });

        it('should mirror the backend very_easy multiplier (0.8)', () => {
            expect(FALLBACK_SCORING_RULES.difficulty_multipliers.very_easy).toBe(0.8);
        });

        it('should have all difficulty multipliers', () => {
            const multipliers = FALLBACK_SCORING_RULES.difficulty_multipliers;

            expect(multipliers).toHaveProperty('very_easy');
            expect(multipliers).toHaveProperty('easy');
            expect(multipliers).toHaveProperty('medium');
            expect(multipliers).toHaveProperty('hard');
            expect(multipliers).toHaveProperty('very_hard');
        });

        it('should have target times for all difficulties', () => {
            const targetTimes = FALLBACK_SCORING_RULES.time_bonus.target_times_seconds;

            expect(targetTimes).toHaveProperty('very_easy');
            expect(targetTimes).toHaveProperty('easy');
            expect(targetTimes).toHaveProperty('medium');
            expect(targetTimes).toHaveProperty('hard');
            expect(targetTimes).toHaveProperty('very_hard');
        });
    });
});
