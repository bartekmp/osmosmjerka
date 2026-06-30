import logger from '@shared/utils/logger';
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { API_ENDPOINTS, STORAGE_KEYS } from "../shared/constants/constants";

export function useCategories({
  debouncedLanguageSetId,
  selectedPrivateListId,
  restored,
  selectedLanguageSetId,
  selectedCategory,
  hasGrid,
  setSelectedCategory,
  setGridStatus,
  onRateLimit,
}) {
  const [categories, setCategories] = useState([]);
  const [ignoredCategories, setIgnoredCategories] = useState([]);
  const [userIgnoredCategories, setUserIgnoredCategories] = useState([]);
  const [categoriesStatus, setCategoriesStatus] = useState("pending");
  const lastFetchedLanguageSetIdRef = useRef(null);
  const selectedCategoryRef = useRef(selectedCategory);
  useEffect(() => { selectedCategoryRef.current = selectedCategory; }, [selectedCategory]);

  // Load ignored categories when language set changes
  useEffect(() => {
    if (!debouncedLanguageSetId) {
      setIgnoredCategories([]);
      setUserIgnoredCategories([]);
      return;
    }

    axios
      .get(`${API_ENDPOINTS.DEFAULT_IGNORED_CATEGORIES}?language_set_id=${debouncedLanguageSetId}`)
      .then((res) => setIgnoredCategories(res.data))
      .catch((err) => {
        setIgnoredCategories([]);
        if (err.response?.status === 429) onRateLimit();
      });

    const token = localStorage.getItem("adminToken");
    axios
      .get(`${API_ENDPOINTS.USER_IGNORED_CATEGORIES}?language_set_id=${debouncedLanguageSetId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then((res) => setUserIgnoredCategories(res.data))
      .catch((err) => {
        setUserIgnoredCategories([]);
        if (err.response?.status === 429) onRateLimit();
      });
  }, [debouncedLanguageSetId, onRateLimit]);

  // Load public categories when language set changes (after restore)
  useEffect(() => {
    if (!restored || selectedPrivateListId) return;
    if (lastFetchedLanguageSetIdRef.current === debouncedLanguageSetId) return;
    lastFetchedLanguageSetIdRef.current = debouncedLanguageSetId;

    let categoriesUrl = API_ENDPOINTS.CATEGORIES;
    if (debouncedLanguageSetId) {
      categoriesUrl += `?language_set_id=${debouncedLanguageSetId}`;
    }

    setCategoriesStatus("pending");
    axios
      .get(categoriesUrl)
      .then((res) => {
        const publicCategories = res.data || [];
        setCategories(["ALL", ...publicCategories]);
        if (publicCategories.length === 0) {
          setCategoriesStatus("empty");
          setGridStatus("empty");
          return;
        }
        setCategoriesStatus("success");
        if (!selectedCategoryRef.current && !hasGrid) {
          const randomCategory = publicCategories[Math.floor(Math.random() * publicCategories.length)];
          setSelectedCategory(randomCategory);
        }
      })
      .catch((err) => {
        logger.error("Error loading categories:", err);
        setCategoriesStatus("error");
        setGridStatus("error");
        if (err.response?.status === 429) onRateLimit();
        lastFetchedLanguageSetIdRef.current = null;
      });
  }, [restored, debouncedLanguageSetId, selectedPrivateListId, hasGrid, setSelectedCategory, setGridStatus, onRateLimit]);

  // Load categories from private list
  useEffect(() => {
    if (!restored || !selectedLanguageSetId) return;

    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);

    if (selectedPrivateListId) {
      setCategoriesStatus("pending");
      axios
        .get(`/api/user/private-lists/${selectedPrivateListId}/categories?language_set_id=${selectedLanguageSetId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        .then((res) => {
          const listCategories = res.data || [];
          setCategories(["ALL", ...listCategories]);
          if (listCategories.length === 0) {
            setCategoriesStatus("empty");
          } else {
            setCategoriesStatus("success");
            if (selectedCategoryRef.current && selectedCategoryRef.current !== "ALL" && !listCategories.includes(selectedCategoryRef.current)) {
              setSelectedCategory("");
            }
          }
        })
        .catch((err) => {
          logger.error("Error loading categories from private list:", err);
          setCategoriesStatus("error");
          setCategories([]);
        });
    } else {
      lastFetchedLanguageSetIdRef.current = null;
    }
  }, [restored, selectedPrivateListId, selectedLanguageSetId, setSelectedCategory]);

  const updateUserIgnoredCategories = (newCategories) => {
    setUserIgnoredCategories(newCategories);
  };

  const visibleCategories = categories.filter(
    (cat) => !ignoredCategories.includes(cat) && !userIgnoredCategories.includes(cat)
  );

  return {
    categories,
    ignoredCategories,
    userIgnoredCategories,
    categoriesStatus,
    setCategoriesStatus,
    visibleCategories,
    updateUserIgnoredCategories,
  };
}
