import { calculateScoreClientSide, DEFAULT_SCORING_RULES } from '../scoringUtils';

describe('scoringUtils', () => {
    describe('calculateScoreClientSide', () => {
        it('should calculate base score correctly', () => {
            const result = calculateScoreClientSide('easy', 5, 10, 300, 0);

            expect(result.base_score).toBe(500); // 5 phrases * 100 points
            expect(result.final_score).toBeGreaterThan(0);
        });

        it('should apply difficulty multiplier for very_hard', () => {
            const result = calculateScoreClientSide('very_hard', 5, 10, 300, 0);

            // very_hard multiplier is 2.0
            // difficulty bonus = baseScore * (2.0 - 1.0) = 500 * 1.0 = 500
            expect(result.difficulty_bonus).toBe(500);
            expect(result.base_score).toBe(500);
        });

        it('should apply difficulty multiplier for very_easy', () => {
            const result = calculateScoreClientSide('very_easy', 5, 10, 300, 0);

            // very_easy multiplier is 0.9
            // difficulty bonus = baseScore * (0.9 - 1.0) = 500 * -0.1 = -50
            expect(result.difficulty_bonus).toBe(-50);
        });

        it('should award completion bonus when all phrases found', () => {
            const result = calculateScoreClientSide('easy', 10, 10, 300, 0);

            expect(result.streak_bonus).toBe(200);
            expect(result.base_score).toBe(1000);
        });

        it('should not award completion bonus when not all phrases found', () => {
            const result = calculateScoreClientSide('easy', 5, 10, 300, 0);

            expect(result.streak_bonus).toBe(0);
        });

        it('should calculate time bonus for fast completion', () => {
            // For easy difficulty, target time is 300 seconds
            // Completing in 150 seconds should give a time bonus
            const result = calculateScoreClientSide('easy', 10, 10, 150, 0);

            expect(result.time_bonus).toBeGreaterThan(0);
            // Time ratio = (300 - 150) / 300 = 0.5
            // Time bonus = 1000 * 0.3 * 0.5 = 150
            expect(result.time_bonus).toBe(150);
        });

        it('should not give time bonus if completed slower than target', () => {
            const result = calculateScoreClientSide('easy', 10, 10, 400, 0);

            expect(result.time_bonus).toBe(0);
        });

        it('should not give time bonus if not all phrases found', () => {
            const result = calculateScoreClientSide('easy', 5, 10, 150, 0);

            expect(result.time_bonus).toBe(0);
        });

        it('should apply hint penalty', () => {
            const result = calculateScoreClientSide('easy', 5, 10, 300, 3);

            expect(result.hint_penalty).toBe(225); // 3 hints * 75 points
            expect(result.hints_used).toBe(3);
        });

        it('should calculate final score correctly with all components', () => {
            // Fast completion with all phrases and no hints
            const result = calculateScoreClientSide('medium', 10, 10, 300, 0);

            // Base: 1000
            // Difficulty bonus (medium = 1.2): 1000 * 0.2 = 200
            // Time bonus (600 target, 300 actual): 1000 * 0.3 * 0.5 = 150 (floored to 149)
            // Completion bonus: 200
            // Hint penalty: 0
            // Total: 1000 + 200 + 149 + 200 = 1549
            expect(result.final_score).toBe(1549);
        });

        it('should not allow negative scores', () => {
            // Use many hints to potentially go negative
            const result = calculateScoreClientSide('very_easy', 1, 10, 300, 10);

            expect(result.final_score).toBeGreaterThanOrEqual(0);
        });

        it('should use default rules when no rules provided', () => {
            const result = calculateScoreClientSide('easy', 5, 10, 300, 0);

            expect(result.base_score).toBe(500);
            expect(result.hint_penalty_per_hint).toBe(DEFAULT_SCORING_RULES.hint_penalty_per_hint);
        });

        it('should use custom rules when provided', () => {
            const customRules = {
                ...DEFAULT_SCORING_RULES,
                base_points_per_phrase: 200,
                hint_penalty_per_hint: 100,
            };

            const result = calculateScoreClientSide('easy', 5, 10, 300, 2, customRules);

            expect(result.base_score).toBe(1000); // 5 * 200
            expect(result.hint_penalty).toBe(200); // 2 * 100
        });

        it('should default to easy difficulty multiplier for unknown difficulty', () => {
            const result = calculateScoreClientSide('unknown_difficulty', 5, 10, 300, 0);

            // Should use easy multiplier (1.0), so difficulty bonus = 0
            expect(result.difficulty_bonus).toBe(0);
        });

        it('should handle edge case of 0 duration', () => {
            const result = calculateScoreClientSide('easy', 10, 10, 0, 0);

            // Time bonus should be 0 when duration is 0
            expect(result.time_bonus).toBe(0);
        });

        it('should return all score breakdown components', () => {
            const result = calculateScoreClientSide('hard', 7, 10, 450, 2);

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

    describe('DEFAULT_SCORING_RULES', () => {
        it('should have all required properties', () => {
            expect(DEFAULT_SCORING_RULES).toHaveProperty('base_points_per_phrase');
            expect(DEFAULT_SCORING_RULES).toHaveProperty('completion_bonus_points');
            expect(DEFAULT_SCORING_RULES).toHaveProperty('difficulty_multipliers');
            expect(DEFAULT_SCORING_RULES).toHaveProperty('hint_penalty_per_hint');
            expect(DEFAULT_SCORING_RULES).toHaveProperty('time_bonus');
        });

        it('should have all difficulty multipliers', () => {
            const multipliers = DEFAULT_SCORING_RULES.difficulty_multipliers;

            expect(multipliers).toHaveProperty('very_easy');
            expect(multipliers).toHaveProperty('easy');
            expect(multipliers).toHaveProperty('medium');
            expect(multipliers).toHaveProperty('hard');
            expect(multipliers).toHaveProperty('very_hard');
        });

        it('should have target times for all difficulties', () => {
            const targetTimes = DEFAULT_SCORING_RULES.time_bonus.target_times_seconds;

            expect(targetTimes).toHaveProperty('very_easy');
            expect(targetTimes).toHaveProperty('easy');
            expect(targetTimes).toHaveProperty('medium');
            expect(targetTimes).toHaveProperty('hard');
            expect(targetTimes).toHaveProperty('very_hard');
        });
    });
});
