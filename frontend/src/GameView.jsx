import { Box, Button, Stack } from "@mui/material";
import {
  AllFoundMessage,
  CrosswordGrid,
  GameControls,
  GameHeader,
  HintButton,
  LoadingOverlay,
  MobileFloatingActions,
  MobilePhraseListSheet,
  PhraseList,
  ScrabbleGrid,
  ScoreDisplay,
  Timer,
} from "./features";
import { NotEnoughPhrasesOverlay, ScreenTooSmallOverlay } from "./shared";

export function GameView({
  // layout
  useMobileLayout,
  compactSidebar,
  isDarkMode,
  isTouchDevice,
  isScreenTooSmall,
  isGridTooSmall,
  // header / branding
  logoFilter,
  onLogoClick,
  showCelebration,
  // routing
  onGameTypeChange,
  // core game state
  gameType,
  selectedCategory,
  setSelectedCategory,
  difficulty,
  setDifficulty,
  availableDifficulties,
  grid,
  phrases,
  found,
  allFound,
  hidePhrases,
  setHidePhrases,
  showTranslations,
  setShowTranslations,
  notEnoughPhrases,
  notEnoughPhrasesMsg,
  isGridLoading,
  // controls
  panelOpen,
  setPanelOpen,
  visibleCategories,
  selectedLanguageSetId,
  onLanguageSetChange,
  onLanguageSetStatusChange,
  selectedPrivateListId,
  setSelectedPrivateListId,
  // scoring
  scoringEnabled,
  currentScore,
  scoreBreakdown,
  scoringRules,
  scoringRulesStatus,
  loadScoringRules,
  openScoreBreakdownDialog,
  registerScoreDialogOpener,
  // timer & pause
  isTimerActive,
  isPaused,
  onPauseToggle,
  onTimerUpdate,
  currentElapsedTime,
  timerResetTrigger,
  gameStartTime,
  // hints
  progressiveHintsEnabled,
  hintsUsed,
  remainingHints,
  currentHintLevel,
  onHintRequest,
  // game interactions
  gridRef,
  onFound,
  onPhraseClick,
  onGridInteraction,
  loadPuzzle,
  refreshPuzzle,
  // user & auth
  currentUser,
  // mobile
  mobileSheetOpen,
  setMobileSheetOpen,
  // i18n
  t,
}) {
  return (
    <Stack spacing={3} sx={{ alignItems: "center" }}>
      <GameHeader
        logoFilter={logoFilter}
        handleLogoClick={onLogoClick}
        showCelebration={showCelebration}
        isDarkMode={isDarkMode}
        currentUser={currentUser}
        gameType={gameType}
        onGameTypeChange={onGameTypeChange}
        isGridLoading={isGridLoading}
      />

      <GameControls
        panelOpen={panelOpen}
        setPanelOpen={setPanelOpen}
        visibleCategories={visibleCategories}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        availableDifficulties={availableDifficulties}
        loadPuzzle={loadPuzzle}
        refreshPuzzle={refreshPuzzle}
        selectedCategoryState={selectedCategory}
        difficultyState={difficulty}
        grid={grid}
        phrases={phrases}
        isLoading={isGridLoading}
        notEnoughPhrases={notEnoughPhrases}
        selectedLanguageSetId={selectedLanguageSetId}
        onLanguageSetChange={onLanguageSetChange}
        onLanguageSetStatusChange={onLanguageSetStatusChange}
        currentUser={currentUser}
        selectedPrivateListId={selectedPrivateListId}
        onPrivateListChange={(listId) => setSelectedPrivateListId(listId)}
        gameType={gameType}
      />

      {/* All Found Message — desktop/sidebar layout only */}
      {!useMobileLayout && (
        <AllFoundMessage
          allFound={allFound}
          loadPuzzle={loadPuzzle}
          refreshPuzzle={refreshPuzzle}
          selectedCategory={selectedCategory}
          difficulty={difficulty}
          canShowBreakdown={scoringEnabled && !!scoreBreakdown}
          onShowBreakdown={openScoreBreakdownDialog}
        />
      )}

      {/* Timer and Score — mobile layout only */}
      {useMobileLayout && scoringEnabled && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            width: "100%",
            flexWrap: "wrap",
          }}
        >
          <Timer
            isActive={isTimerActive}
            isPaused={isPaused}
            onTimeUpdate={onTimerUpdate}
            startTime={gameStartTime}
            resetTrigger={timerResetTrigger}
            showTimer={scoringEnabled}
            currentElapsedTime={currentElapsedTime}
            onTogglePause={onPauseToggle}
            canPause={found.length > 0 && !allFound}
          />
          <ScoreDisplay
            currentScore={currentScore}
            scoreBreakdown={scoreBreakdown}
            phrasesFound={found.length}
            totalPhrases={phrases.length}
            hintsUsed={hintsUsed}
            showScore={scoringEnabled}
            compact={true}
            scoringRules={scoringRules}
            scoringRulesStatus={scoringRulesStatus}
            onReloadScoringRules={() => loadScoringRules({ force: true })}
            registerDialogOpener={registerScoreDialogOpener}
          />
          {allFound && (
            <Button
              onClick={() => refreshPuzzle(selectedCategory, difficulty)}
              variant="contained"
              sx={{ minWidth: "48px", minHeight: "48px", fontSize: "1.5rem" }}
            >
              🆕
            </Button>
          )}
        </Box>
      )}

      {/* Main Game Area */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          width: "100%",
          maxWidth: "100vw",
          position: "relative",
          gap: useMobileLayout ? 3 : { xs: 3, md: 6 },
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "relative",
            flex: "0 0 auto",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: useMobileLayout ? "100%" : "auto",
            maxWidth: "100%",
          }}
        >
          <Box
            sx={{
              filter: isScreenTooSmall || isGridTooSmall ? "blur(8px)" : "none",
              pointerEvents: isScreenTooSmall || isGridTooSmall ? "none" : "auto",
            }}
          >
            {gameType === "crossword" ? (
              <CrosswordGrid
                key={`crossword-${selectedCategory}-${difficulty}`}
                ref={gridRef}
                grid={grid}
                phrases={phrases}
                onPhraseComplete={onFound}
                onPhraseWrong={() => {}}
                disabled={allFound || isScreenTooSmall || isGridTooSmall}
                isDarkMode={isDarkMode}
                showWrongHighlight={true}
                onHintUsed={() => {}}
                isTouchDevice={isTouchDevice}
                useMobileLayout={useMobileLayout}
                isLoading={isGridLoading}
              />
            ) : (
              <ScrabbleGrid
                key={`wordsearch-${selectedCategory}-${difficulty}`}
                ref={gridRef}
                grid={grid}
                phrases={phrases}
                found={found}
                onFound={onFound}
                disabled={allFound || isScreenTooSmall || isGridTooSmall}
                isDarkMode={isDarkMode}
                showCelebration={showCelebration}
                onHintUsed={() => {}}
                onGridInteraction={onGridInteraction}
                isTouchDevice={isTouchDevice}
                useMobileLayout={useMobileLayout}
                isLoading={isGridLoading}
              />
            )}
          </Box>

          <LoadingOverlay isLoading={isGridLoading} isDarkMode={isDarkMode} />

          <NotEnoughPhrasesOverlay
            show={notEnoughPhrases}
            message={notEnoughPhrasesMsg}
            isDarkMode={isDarkMode}
          />

          <ScreenTooSmallOverlay
            visible={isScreenTooSmall || isGridTooSmall}
            isGridTooSmall={isGridTooSmall}
          />
        </Box>

        {/* Sidebar: Phrase List and Controls */}
        {!useMobileLayout && (
          <Box
            sx={{
              width: { md: 280, lg: 320 },
              display: "flex",
              flexDirection: "column",
              gap: 2,
              position: "sticky",
              top: 24,
              maxHeight: "calc(100vh - 48px)",
              overflowY: "auto",
              pr: 1,
            }}
          >
            {scoringEnabled && (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "row", sm: "row" },
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: 2,
                  mb: 2,
                  flexWrap: "wrap",
                }}
              >
                <Timer
                  isActive={isTimerActive}
                  isPaused={isPaused}
                  onTimeUpdate={onTimerUpdate}
                  startTime={gameStartTime}
                  resetTrigger={timerResetTrigger}
                  showTimer={scoringEnabled}
                  currentElapsedTime={currentElapsedTime}
                  onTogglePause={onPauseToggle}
                  canPause={found.length > 0 && !allFound}
                />
                <ScoreDisplay
                  currentScore={currentScore}
                  scoreBreakdown={scoreBreakdown}
                  phrasesFound={found.length}
                  totalPhrases={phrases.length}
                  hintsUsed={hintsUsed}
                  showScore={scoringEnabled}
                  compact={true}
                  scoringRules={scoringRules}
                  scoringRulesStatus={scoringRulesStatus}
                  onReloadScoringRules={() => loadScoringRules({ force: true })}
                  registerDialogOpener={registerScoreDialogOpener}
                />
              </Box>
            )}

            {progressiveHintsEnabled &&
              phrases.length > 0 &&
              found.length < phrases.length && (
                <HintButton
                  onHintRequest={onHintRequest}
                  remainingHints={remainingHints}
                  isProgressiveMode={progressiveHintsEnabled}
                  disabled={allFound || phrases.length === 0 || isGridTooSmall || isGridLoading}
                  maxHints={gameType === "crossword" ? phrases.length : 3}
                  showHintButton={true}
                  compact={compactSidebar}
                  gameType={gameType}
                />
              )}

            <PhraseList
              phrases={phrases}
              found={found}
              hidePhrases={hidePhrases}
              setHidePhrases={setHidePhrases}
              onPhraseClick={onPhraseClick}
              gameType={gameType}
              showTranslations={showTranslations}
              setShowTranslations={setShowTranslations}
              disableShowPhrases={notEnoughPhrases || isGridTooSmall}
              currentUser={currentUser}
              languageSetId={selectedLanguageSetId}
              compact={compactSidebar}
              isLoading={isGridLoading}
            />
          </Box>
        )}
      </Box>

      {/* Mobile: Floating Actions */}
      {useMobileLayout && (
        <MobileFloatingActions
          onPhraseListClick={() => setMobileSheetOpen(true)}
          onHintClick={onHintRequest}
          phrasesFound={found.length}
          remainingHints={remainingHints}
          showHintButton={
            progressiveHintsEnabled &&
            phrases.length > 0 &&
            found.length < phrases.length
          }
          disabled={allFound || isGridTooSmall}
          isProgressiveMode={progressiveHintsEnabled}
          gameType={gameType}
          currentHintLevel={currentHintLevel}
        />
      )}

      {/* Mobile: Bottom Sheet */}
      {useMobileLayout && (
        <MobilePhraseListSheet
          open={mobileSheetOpen}
          onClose={() => setMobileSheetOpen(false)}
          phrases={phrases}
          found={found}
          hidePhrases={hidePhrases}
          setHidePhrases={setHidePhrases}
          allFound={allFound}
          showTranslations={showTranslations}
          setShowTranslations={setShowTranslations}
          disableShowPhrases={notEnoughPhrases || isGridTooSmall}
          onPhraseClick={onPhraseClick}
          progressiveHintsEnabled={progressiveHintsEnabled}
          currentUser={currentUser}
          languageSetId={selectedLanguageSetId}
          t={t}
          gameType={gameType}
          isLoading={isGridLoading}
        />
      )}
    </Stack>
  );
}
