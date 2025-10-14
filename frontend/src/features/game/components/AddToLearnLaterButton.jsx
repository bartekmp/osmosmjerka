import React, { useState, useEffect, useMemo, useRef } from 'react';
import { IconButton, Tooltip, Snackbar, Alert } from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { STORAGE_KEYS } from '../../../shared/constants/constants';

export default function AddToLearnLaterButton({ 
  type = 'all', // 'all' or 'selected'
  phrases = [],
  languageSetId,
  currentUser,
  disabled = false,
  onSuccess = () => {}
}) {
  const { t } = useTranslation();
  const [isAdding, setIsAdding] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [notification, setNotification] = useState(null);
  const [phrasesInList, setPhrasesInList] = useState(new Set());
  const [isCheckingList, setIsCheckingList] = useState(false);
  
  // Track the last checked phrase IDs to prevent unnecessary re-checks
  const lastCheckedIdsRef = useRef('');

  // Memoize phrase IDs to avoid re-creating array on every render
  const phraseIds = useMemo(() => {
    return phrases.map(p => p.id).filter(Boolean);
  }, [phrases]);

  // Create a stable string representation of phrase IDs for comparison
  const phraseIdsKey = useMemo(() => {
    return phraseIds.sort((a, b) => a - b).join(',');
  }, [phraseIds]);

  // Check which phrases are already in "Learn This Later" list
  useEffect(() => {
    const checkPhrasesInList = async () => {
      if (!currentUser || !languageSetId || phraseIds.length === 0) {
        setPhrasesInList(new Set());
        return;
      }

      // Skip if we already checked these exact phrase IDs
      if (lastCheckedIdsRef.current === phraseIdsKey) {
        return;
      }

      setIsCheckingList(true);
      try {
        const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
        if (!token) {
          setIsCheckingList(false);
          return;
        }

        const response = await axios.post('/api/user/learn-later/check', {
          language_set_id: languageSetId,
          phrase_ids: phraseIds
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        setPhrasesInList(new Set(response.data.in_list || []));
        lastCheckedIdsRef.current = phraseIdsKey; // Mark these IDs as checked
      } catch (error) {
        console.error('Failed to check phrases in list:', error);
        setPhrasesInList(new Set());
      } finally {
        setIsCheckingList(false);
      }
    };

    checkPhrasesInList();
  }, [phraseIds, phraseIdsKey, languageSetId, currentUser]);

  // Don't render button if user is not logged in
  if (!currentUser) {
    return null;
  }
  
  // Debug logging to help troubleshoot
  if (phrases.length > 0 && phraseIds.length === 0) {
    console.warn('AddToLearnLaterButton: phrases exist but no IDs found', {
      phrasesCount: phrases.length,
      firstPhrase: phrases[0],
      type
    });
  }
  
  const newPhrases = phraseIds.filter(id => !phrasesInList.has(id));
  const alreadyAddedCount = phraseIds.length - newPhrases.length;
  const allAlreadyAdded = phraseIds.length > 0 && newPhrases.length === 0;

  const isDisabled = disabled || 
                     phrases.length === 0 || 
                     isAdding || 
                     isCheckingList ||
                     allAlreadyAdded;

  const handleClick = async () => {
    if (newPhrases.length === 0 || !currentUser) return;

    setIsAdding(true);
    try {
      const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Add only new phrases to "Learn This Later" list
      const response = await axios.post('/api/user/learn-later/bulk', {
        language_set_id: languageSetId,
        phrase_ids: newPhrases
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update local state to mark these phrases as added
      setPhrasesInList(prev => new Set([...prev, ...newPhrases]));
      
      // Update the last checked IDs key to include the newly added phrases
      lastCheckedIdsRef.current = [...phraseIds].sort((a, b) => a - b).join(',');

      // Show success animation
      setShowSuccess(true);
      
      const messageKey = type === 'selected' 
        ? 'learnLater.added_selected_to_learn_later' 
        : 'learnLater.added_to_learn_later_count';
      
      setNotification({
        message: t(messageKey, { count: response.data.added_count }),
        severity: 'success'
      });

      // Call success callback
      onSuccess();

      // Reset icon after 2 seconds
      setTimeout(() => setShowSuccess(false), 2000);

    } catch (error) {
      setNotification({
        message: error.response?.data?.error || t('learnLater.failed_to_add'),
        severity: 'error'
      });
    } finally {
      setIsAdding(false);
    }
  };

  // Determine tooltip text
  const getTooltipText = () => {
    if (phrases.length === 0) {
      return type === 'selected' 
        ? t('learnLater.select_phrases_first') 
        : t('learnLater.find_phrases_first');
    }
    
    if (allAlreadyAdded) {
      return type === 'selected'
        ? t('learnLater.selected_already_saved')
        : t('learnLater.all_phrases_already_saved');
    }
    
    if (alreadyAddedCount > 0) {
      const key = type === 'selected' 
        ? 'learnLater.add_selected_new_tooltip' 
        : 'learnLater.add_new_phrases_tooltip';
      return t(key, { 
        new: newPhrases.length, 
        already: alreadyAddedCount 
      });
    }
    
    const key = type === 'selected' 
      ? 'learnLater.add_selected_to_learn_later' 
      : 'learnLater.add_found_to_learn_later';
    return t(key, { count: phrases.length });
  };

  // Determine button color
  const getButtonColor = () => {
    if (allAlreadyAdded) {
      return 'success.main'; // Green when all are already added
    }
    if (showSuccess) {
      return 'success.main'; // Green after successful add
    }
    return type === 'selected' ? 'secondary.main' : 'primary.main';
  };

  // Choose icon based on type
  const Icon = () => {
    if (showSuccess || allAlreadyAdded) {
      return <CheckCircleIcon fontSize="small" />;
    }
    return type === 'selected' 
      ? <PlaylistAddCheckIcon fontSize="small" />
      : <AddCircleOutlineIcon fontSize="small" />;
  };

  return (
    <>
      <Tooltip title={getTooltipText()} placement="top" arrow>
        <span> {/* Wrapper for disabled tooltip */}
          <IconButton
            size="small"
            onClick={handleClick}
            disabled={isDisabled}
            sx={{
              width: 28,
              height: 28,
              minWidth: 28,
              padding: 0,
              color: getButtonColor(),
              transition: 'all 0.3s ease',
              '&:hover:not(.Mui-disabled)': {
                backgroundColor: allAlreadyAdded 
                  ? 'success.light' 
                  : type === 'selected' 
                    ? 'secondary.light' 
                    : 'primary.light',
                color: allAlreadyAdded 
                  ? 'success.dark' 
                  : type === 'selected' 
                    ? 'secondary.dark' 
                    : 'primary.dark',
                transform: 'scale(1.1)',
              },
              '&.Mui-disabled': {
                color: allAlreadyAdded ? 'success.main' : 'action.disabled',
                opacity: allAlreadyAdded ? 0.7 : 0.38,
              },
              // Larger touch target on mobile
              '@media (max-width: 600px)': {
                minWidth: 44,
                minHeight: 44,
              }
            }}
            aria-label={getTooltipText()}
          >
            <Icon />
          </IconButton>
        </span>
      </Tooltip>

      {/* Success/Error notification */}
      {notification && (
        <Snackbar
          open={!!notification}
          autoHideDuration={3000}
          onClose={() => setNotification(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            onClose={() => setNotification(null)} 
            severity={notification.severity}
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      )}
    </>
  );
}
