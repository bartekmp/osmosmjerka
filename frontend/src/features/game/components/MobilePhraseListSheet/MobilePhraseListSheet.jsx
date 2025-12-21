import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Drawer, IconButton, Typography, Divider } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PhraseList from '../PhraseList';
import AddToLearnLaterButton from '../AddToLearnLaterButton';
import './MobilePhraseListSheet.css';

/**
 * Mobile bottom sheet component for phrase list
 * Swipeable drawer that slides up from bottom
 */
const MobilePhraseListSheet = ({
  open,
  onClose,
  phrases,
  found,
  _hidePhrases,
  setHidePhrases,
  allFound,
  showTranslations,
  setShowTranslations,
  disableShowPhrases,
  onPhraseClick,
  progressiveHintsEnabled,
  currentUser,
  languageSetId,
  t
}) => {
  const { t: translate } = useTranslation();
  const sheetRef = useRef(null);
  const dragStartY = useRef(null);
  const dragCurrentY = useRef(null);
  const isDragging = useRef(false);
  const [sheetHeight, setSheetHeight] = useState(0.5); // 0-1, represents percentage of screen height

  // Get found phrases with their full data
  const foundPhrases = phrases.filter(p => found.includes(p.phrase));
  const canToggleTranslations = found.length > 0;

  // Handle touch start on drag handle
  const handleHandleTouchStart = useCallback((e) => {
    if (!open) return;
    e.stopPropagation();
    const touch = e.touches[0];
    dragStartY.current = touch.clientY;
    dragCurrentY.current = touch.clientY;
    isDragging.current = true;
  }, [open]);

  // Handle touch move
  const handleTouchMove = useCallback((e) => {
    if (!isDragging.current || !open) return;
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    dragCurrentY.current = touch.clientY;

    const deltaY = dragCurrentY.current - dragStartY.current;
    const windowHeight = window.innerHeight;
    const maxHeight = windowHeight * 0.85; // Max 85% of screen
    const minHeight = windowHeight * 0.5; // Min 50% of screen

    // Calculate new height based on drag
    const currentHeight = windowHeight * sheetHeight;
    const newHeight = Math.max(minHeight, Math.min(maxHeight, currentHeight - deltaY));
    const newSheetHeight = newHeight / windowHeight;

    setSheetHeight(newSheetHeight);
    dragStartY.current = dragCurrentY.current; // Update start position for smooth dragging
  }, [open, sheetHeight]);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const dragDistance = dragCurrentY.current - (dragStartY.current || dragCurrentY.current);

    // If dragged down significantly, close the sheet
    if (dragDistance > 100 || sheetHeight < 0.55) {
      onClose();
      setSheetHeight(0.5); // Reset to default
    } else {
      // Snap to nearest position (50%, 70%, or 85%)
      const snapPoints = [0.5, 0.7, 0.85];
      const currentRatio = sheetHeight;
      const nearestSnap = snapPoints.reduce((prev, curr) =>
        Math.abs(curr - currentRatio) < Math.abs(prev - currentRatio) ? curr : prev
      );
      setSheetHeight(nearestSnap);
    }

    dragStartY.current = null;
    dragCurrentY.current = null;
  }, [open, sheetHeight, onClose]);

  // Reset sheet height when opening
  useEffect(() => {
    if (open) {
      setSheetHeight(0.5); // Start at 50% height
    }
  }, [open]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleBackdropClick = (e) => {
    // Only close if clicking the backdrop, not the sheet content
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      ModalProps={{
        keepMounted: false,
        onBackdropClick: handleBackdropClick,
      }}
      PaperProps={{
        ref: sheetRef,
        className: 'mobile-phrase-sheet',
        style: {
          height: `${sheetHeight * 100}%`,
          maxHeight: '85%',
          minHeight: '50%',
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          transition: isDragging.current ? 'none' : 'height 0.3s ease-out',
        },
      }}
      sx={{
        '& .MuiDrawer-paper': {
          overflow: 'visible',
        },
      }}
    >
      <Box className="mobile-phrase-sheet-content">
        {/* Drag handle */}
        <Box
          className="mobile-phrase-sheet-handle"
          onTouchStart={handleHandleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <Box className="mobile-phrase-sheet-handle-bar" />
        </Box>

        {/* Header */}
        <Box className="mobile-phrase-sheet-header">
          <Typography variant="h6" className="mobile-phrase-sheet-title">
            {translate('phrases_capitalized')} ({found.length}/{phrases.length})
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {canToggleTranslations && (
              <button
                className="scrabble-btn phrase-list-toggle-translations"
                type="button"
                onClick={() => setShowTranslations(t => !t)}
                aria-label={showTranslations ? translate('hide_all_translations') : translate('show_all_translations')}
                style={{ fontSize: '1.1em', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '40px', height: '40px' }}
              >
                <span>{showTranslations ? '◀' : '▶'}</span>
              </button>
            )}
            <IconButton
              size="small"
              onClick={onClose}
              className="mobile-phrase-sheet-close"
              aria-label={translate('close')}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        <Divider />

        {/* Phrase List Content */}
        <Box className="mobile-phrase-sheet-body">
          <PhraseList
            phrases={phrases}
            found={found}
            hidePhrases={false}
            setHidePhrases={setHidePhrases}
            allFound={allFound}
            showTranslations={showTranslations}
            setShowTranslations={setShowTranslations}
            disableShowPhrases={disableShowPhrases}
            onPhraseClick={onPhraseClick}
            progressiveHintsEnabled={progressiveHintsEnabled}
            currentUser={currentUser}
            languageSetId={languageSetId}
            hideToggleButton={true}
            t={t}
          />
        </Box>

        {/* Learn This Later Section */}
        {currentUser && foundPhrases.length > 0 && (
          <Box className="mobile-phrase-sheet-footer">
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
              <AddToLearnLaterButton
                type="all"
                phrases={foundPhrases}
                languageSetId={languageSetId}
                currentUser={currentUser}
                disabled={foundPhrases.length === 0}
              />
            </Box>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};

export default MobilePhraseListSheet;

