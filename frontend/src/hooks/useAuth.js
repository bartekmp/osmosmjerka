import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { API_ENDPOINTS, STORAGE_KEYS } from "../shared/constants/constants";

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(null);
  const [statisticsEnabled, setStatisticsEnabled] = useState(true);

  const fetchAuthenticatedUser = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    if (!token) {
      setCurrentUser(null);
      return null;
    }
    try {
      const profileResponse = await axios.get(API_ENDPOINTS.USER_PROFILE, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!profileResponse.data) {
        setCurrentUser(null);
        return null;
      }
      setCurrentUser(profileResponse.data);
      return profileResponse.data;
    } catch (error) {
      console.warn("Failed to load authenticated user profile:", error);
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

    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
    if (!token) return;
    try {
      const response = await axios.get(
        `${API_ENDPOINTS.ADMIN}/settings/statistics-enabled`,
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );
      if (response.data.enabled === false) {
        setStatisticsEnabled(false);
      }
    } catch (_err) {
      console.warn("Failed to load statistics settings:", _err);
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
