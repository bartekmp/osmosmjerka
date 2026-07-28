import apiClient, { getAuthToken } from '@shared/utils/apiClient';
import logger from '@shared/utils/logger';
import { useCallback, useEffect, useState } from "react";
import { API_ENDPOINTS } from "../shared/constants/constants";

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(null);
  const [statisticsEnabled, setStatisticsEnabled] = useState(true);

  const fetchAuthenticatedUser = useCallback(async () => {
    if (!getAuthToken()) {
      setCurrentUser(null);
      return null;
    }
    try {
      const profileResponse = await apiClient.get(API_ENDPOINTS.USER_PROFILE);
      if (!profileResponse.data) {
        setCurrentUser(null);
        return null;
      }
      setCurrentUser(profileResponse.data);
      return profileResponse.data;
    } catch (error) {
      logger.warn("Failed to load authenticated user profile:", error);
      setCurrentUser(null);
      return null;
    }
  }, []);

  const checkStatisticsEnabled = useCallback(async () => {
    const userProfile = await fetchAuthenticatedUser();
    if (!userProfile) {
      setStatisticsEnabled(false);
      return;
    }
    setStatisticsEnabled(true);

    if (userProfile.role !== "root_admin") return;

    if (!getAuthToken()) return;
    try {
      const response = await apiClient.get(`${API_ENDPOINTS.ADMIN}/settings/statistics-enabled`);
      if (response.data.enabled === false) {
        setStatisticsEnabled(false);
      }
    } catch (_err) {
      logger.warn("Failed to load statistics settings:", _err);
    }
  }, [fetchAuthenticatedUser]);

  useEffect(() => {
    checkStatisticsEnabled();
  }, [checkStatisticsEnabled]);

  useEffect(() => {
    const handleAuthChanged = () => checkStatisticsEnabled();
    window.addEventListener("admin-auth-changed", handleAuthChanged);
    return () => window.removeEventListener("admin-auth-changed", handleAuthChanged);
  }, [checkStatisticsEnabled]);

  return { currentUser, statisticsEnabled, fetchAuthenticatedUser };
}
