import { restoreGameState, saveGameState } from "../appHelpers";

/**
 * The game-state round trip through localStorage. Found words, the grid and the timer
 * already survive a reload; the hint counters did not, which made the three-hint limit
 * meaningless - reloading after each hint handed out a fresh three.
 */
describe("game state round trip", () => {
    const aGameInProgress = {
        grid: [["A", "B"], ["C", "D"]],
        phrases: [{ phrase: "AB", translation: "ab" }, { phrase: "CD", translation: "cd" }],
        found: ["AB"],
        selectedCategory: "animals",
        difficulty: "easy",
        hidePhrases: false,
        allFound: false,
        showTranslations: true,
        elapsedTimeSeconds: 42,
        isPaused: false,
        gameType: "word_search",
    };

    function settersSpy() {
        return {
            setGrid: jest.fn(),
            setPhrases: jest.fn(),
            setFound: jest.fn(),
            setSelectedCategory: jest.fn(),
            setDifficulty: jest.fn(),
            setHidePhrases: jest.fn(),
            setShowTranslations: jest.fn(),
            setRestored: jest.fn(),
            setGameStartTime: jest.fn(),
            setCurrentElapsedTime: jest.fn(),
            setGridStatus: jest.fn(),
            setIsPaused: jest.fn(),
            setGameType: jest.fn(),
            setHintsUsed: jest.fn(),
            setRemainingHints: jest.fn(),
        };
    }

    beforeEach(() => {
        localStorage.clear();
    });

    it("brings back the used-hint count after a reload", () => {
        saveGameState({ ...aGameInProgress, hintsUsed: 1, remainingHints: 2 });

        const setters = settersSpy();
        expect(restoreGameState(setters)).toBe(true);

        expect(setters.setHintsUsed).toHaveBeenCalledWith(1);
        expect(setters.setRemainingHints).toHaveBeenCalledWith(2);
    });

    it("still restores the rest of the game", () => {
        saveGameState(aGameInProgress);

        const setters = settersSpy();
        expect(restoreGameState(setters)).toBe(true);

        expect(setters.setFound).toHaveBeenCalledWith(["AB"]);
        expect(setters.setCurrentElapsedTime).toHaveBeenCalledWith(42);
        expect(setters.setGameType).toHaveBeenCalledWith("word_search");
    });

    it("leaves the hint counters alone for a save written before they were tracked", () => {
        // Existing players have a saved game with no hint fields in it. Restoring must not
        // hand them `undefined` hints - the defaults in App.jsx have to stand.
        saveGameState(aGameInProgress);

        const setters = settersSpy();
        restoreGameState(setters);

        expect(setters.setHintsUsed).not.toHaveBeenCalled();
        expect(setters.setRemainingHints).not.toHaveBeenCalled();
    });

    it("does not restore a finished game", () => {
        saveGameState({ ...aGameInProgress, found: ["AB", "CD"], allFound: true });

        const setters = settersSpy();
        expect(restoreGameState(setters)).toBe(false);
    });
});
