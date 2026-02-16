import SchoolIcon from '@mui/icons-material/School';
import {
    Divider,
    Stack,
    TextField,
    Typography,
    Button,
} from '@mui/material';
import { AdminButton, AdminLayout, API_ENDPOINTS, STORAGE_KEYS } from '@shared';
import { RateLimitWarning } from '@shared/components/ui/RateLimitWarning';
import {
    PaddedContainer,
    RightAlignedBox,
    ContentPaper,
    FormBox,
    ErrorBox,
    WarningBox,
    Paper,
    Box,
} from '@shared/components/ui/StyledComponents';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isTokenExpired } from './helpers';
import LanguageSetManagement from './LanguageSetManagement';
import DuplicateManagement from './DuplicateManagement';
import { useAdminApi } from './useAdminApi';
import UserManagement from './UserManagement';
import UserProfile from './UserProfile';
import MyStudy from './MyStudy';
import StatisticsDashboard from '../StatisticsDashboard/StatisticsDashboard';
import SystemSettings from '../SystemSettings/SystemSettings';
import TeacherDashboard from '../TeacherDashboard/TeacherDashboard';
import BrowseRecordsContainer from '../BrowseRecords/BrowseRecordsContainer';
import { PrivateListManager } from '../../../lists';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { Badge, Popover, IconButton } from '@mui/material';
import { useNotifications } from './useNotifications';
import NotificationList from '../Notifications/NotificationList';
import PropTypes from 'prop-types';

import { useAdminLayout } from '../../hooks/useAdminLayout';

export default function AdminPanel({
    ignoredCategories = [],
    userIgnoredCategories = [],
    onUpdateUserIgnoredCategories = () => { }
}) {
    const { t } = useTranslation();
    const [auth, setAuth] = useState({ user: '', pass: '' });
    const [error, setError] = useState("");
    const [isLogged, setIsLogged] = useState(false);
    const [dashboard, setDashboard] = useState(true);
    const [browseRecords, setBrowseRecords] = useState(false);
    const [userManagement, setUserManagement] = useState(false);
    const [userProfile, setUserProfile] = useState(false);
    const [statisticsDashboard, setStatisticsDashboard] = useState(false);
    const [systemSettings, setSystemSettings] = useState(false);
    const [languageSetManagement, setLanguageSetManagement] = useState(false);
    const [duplicateManagement, setDuplicateManagement] = useState(false);
    const [listManagement, setListManagement] = useState(false);
    const [showListManager, setShowListManager] = useState(false);
    const [selectedLanguageSetForLists, setSelectedLanguageSetForLists] = useState(null);
    const [teacherDashboard, setTeacherDashboard] = useState(false);
    const [myStudy, setMyStudy] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [categories, setCategories] = useState([]);
    const [languageSets, setLanguageSets] = useState([]);
    const [languageSetsLoading, setLanguageSetsLoading] = useState(true);
    const [selectedLanguageSetId, setSelectedLanguageSetId] = useState(() => {
        // Load from localStorage or default to null (will be set when language sets load)
        const saved = localStorage.getItem(STORAGE_KEYS.SELECTED_LANGUAGE_SET);
        return saved ? parseInt(saved) : null;
    });

    const [languageSetsLoaded, setLanguageSetsLoaded] = useState(false);
    const [categoriesLoaded, setCategoriesLoaded] = useState(false);
    const { isControlBarCollapsed, isLayoutCompact, containerRef } = useAdminLayout();

    const [token, setToken] = useState(localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN) || '');
    const [tokenExpired, setTokenExpired] = useState(false); // Track if token expired (vs. user logged out)

    const role = currentUser?.role;
    const canAccessTeacher = ['teacher', 'admin', 'root_admin', 'administrative'].includes(role);
    const canManageRecords = ['admin', 'root_admin', 'administrative'].includes(role);
    const canManageAdvanced = ['root_admin', 'administrative'].includes(role);

    const {
        handleLogin,
        showFetchRateLimit
    } = useAdminApi({
        token,
        setError,
        setToken,
        setIsLogged,
        setDashboard
    });

    // Notifications
    const {
        notifications,
        unreadCount,
        loading: notificationsLoading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification
    } = useNotifications(token, isLogged);

    const [notificationAnchorEl, setNotificationAnchorEl] = useState(null);
    const handleNotificationClick = (event) => {
        setNotificationAnchorEl(event.currentTarget);
        fetchNotifications();
    };
    const handleNotificationClose = () => {
        setNotificationAnchorEl(null);
    };
    const openNotifications = Boolean(notificationAnchorEl);

    // Handle notification navigation
    const handleNotificationNavigate = (link) => {
        handleNotificationClose();
        // Parse link: /teacher-dashboard?tab=2&set_id=123
        if (link.startsWith('/teacher-dashboard')) {
            setDashboard(false);
            setTeacherDashboard(true);
            // TODO: Handle deep linking to specific set in the future
            // const url = new URL(link, window.location.origin);
            // const setId = url.searchParams.get('set_id');
        }
    };



    // Helper function to handle authentication errors
    const handleAuthError = useCallback((response) => {
        // Check if it's an authentication error (400 or 401)
        if (response.status === 401 || response.status === 400) {
            setTokenExpired(true); // Mark that token expired
            setToken('');
            localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
            setIsLogged(false);
            setDashboard(true);
            return true;
        }
        return false;
    }, [setDashboard]);



    useEffect(() => {
        // Only make admin API calls if user is properly logged in
        if (!isLogged || !token) {
            // Clear admin data when not logged in
            setCategories([]);
            setLanguageSets([]);

            setLanguageSetsLoading(true);
            setLanguageSetsLoaded(false);
            setCategoriesLoaded(false);
            return;
        }

        // Always load language sets when user logs in (needed for dashboard button logic)
        if (!languageSetsLoaded && currentUser) {
            // Use different endpoints based on user role
            const endpoint = currentUser?.role === 'admin' || currentUser?.role === 'root_admin'
                ? API_ENDPOINTS.ADMIN_LANGUAGE_SETS
                : API_ENDPOINTS.LANGUAGE_SETS;


            fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
                .then(res => {
                    if (!res.ok) {
                        if (handleAuthError(res)) {
                            return;
                        }
                        throw new Error('Failed to load language sets');
                    }
                    return res.json();
                })
                .then(data => {
                    if (data) {
                        setLanguageSets(data);
                        setLanguageSetsLoading(false);
                        setLanguageSetsLoaded(true);
                        // Auto-select first language set if none is selected
                        if (data.length > 0 && !selectedLanguageSetId) {
                            const firstSetId = data[0].id;
                            setSelectedLanguageSetId(firstSetId);
                            localStorage.setItem(STORAGE_KEYS.SELECTED_LANGUAGE_SET, firstSetId.toString());
                        }
                        // If no language sets exist, show error
                        if (data.length === 0) {
                            setError(t('no_language_sets_error'));
                        }
                    }
                })
                .catch(err => {
                    console.error('Failed to load language sets:', err);
                    setLanguageSetsLoading(false);
                });
        }
    }, [isLogged, token, languageSetsLoaded, currentUser, handleAuthError]);

    // Separate useEffect for categories that depends on selectedLanguageSetId
    useEffect(() => {
        // Reset categories loaded flag when language set changes
        setCategoriesLoaded(false);
    }, [selectedLanguageSetId]);

    useEffect(() => {
        // Only load categories when navigating to views that need them and language set is selected
        const needsCategories = browseRecords || languageSetManagement;
        if (isLogged && token && selectedLanguageSetId && needsCategories && !categoriesLoaded) {
            fetch(`${API_ENDPOINTS.ALL_CATEGORIES}?language_set_id=${selectedLanguageSetId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
                .then(res => {
                    if (!res.ok) {
                        if (handleAuthError(res)) {
                            return;
                        }
                        throw new Error('Failed to load categories');
                    }
                    return res.json();
                })
                .then(data => {
                    if (data) {
                        setCategories(data);
                        setCategoriesLoaded(true);
                    }
                })
                .catch(err => console.error('Failed to load categories:', err));
        }
    }, [isLogged, token, selectedLanguageSetId, dashboard, userManagement, userProfile, statisticsDashboard, systemSettings, languageSetManagement, duplicateManagement, categoriesLoaded, handleAuthError]);



    // Check token on mount and after login
    useEffect(() => {
        if (token) {
            if (isTokenExpired(token)) {
                setTokenExpired(true); // Mark that token expired
                setIsLogged(false);
                setToken('');
                localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
                return;
            }
            fetch(API_ENDPOINTS.USER_PROFILE, {
                headers: token
                    ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
                    : {}
            })
                .then(res => {
                    if (!res.ok) {
                        if (handleAuthError(res)) {
                            return;
                        }
                        throw new Error("Unauthorized or server error");
                    }
                    return res.json();
                })
                .then(data => {
                    if (data) {
                        setIsLogged(true);
                        setCurrentUser(data); // Profile endpoint returns user data directly
                        setTokenExpired(false); // Reset expired flag on successful login
                    }
                })
                .catch(() => {
                    setIsLogged(false);
                    setToken('');
                    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
                    // Don't reset tokenExpired here - it might have been set by handleAuthError
                });
        } else {
            // No token - only reset expired flag if it wasn't already set (to preserve expired state)
            // This prevents clearing the expired message when token is removed after expiration
            // We use a functional update to access the current tokenExpired value
            setTokenExpired(prev => prev ? prev : false);
        }

    }, [token, handleAuthError]);



    // Logout handler
    const handleLogout = () => {
        setToken('');
        localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
        setIsLogged(false);
        setCurrentUser(null);
        setTokenExpired(false); // User logged out on purpose, not expired
        setDashboard(true);
        setUserManagement(false);
        setLanguageSetManagement(false);
        setDuplicateManagement(false);
        setUserProfile(false);
        setStatisticsDashboard(false);
        setSystemSettings(false);
        setTeacherDashboard(false);
        setMyStudy(false);
        window.dispatchEvent(new window.Event('admin-auth-changed'));
    };

    // Helper function to properly navigate back to dashboard
    const goToDashboard = () => {
        setBrowseRecords(false);
        setUserManagement(false);
        setLanguageSetManagement(false);
        setDuplicateManagement(false);
        setListManagement(false);
        setUserProfile(false);
        setStatisticsDashboard(false);
        setSystemSettings(false);
        setTeacherDashboard(false);
        setMyStudy(false);
        setDashboard(true);
    };

    if (!isLogged) {
        return (
            <PaddedContainer maxWidth="sm">
                <RightAlignedBox>
                    <AdminButton
                        to="/"
                        desktopText={`⇇ ${t('back_to_game')}`}
                        mobileText="🏠"
                    />
                </RightAlignedBox>
                <ContentPaper>
                    <Typography variant="h4" component="h2" gutterBottom align="center">
                        {t('admin_login')}
                    </Typography>
                    <FormBox
                        component="form"
                        onSubmit={e => {
                            e.preventDefault();
                            handleLogin(auth, setError, (user) => {
                                setCurrentUser(user);
                                setTokenExpired(false); // Reset expired flag on successful login
                            });
                        }}
                    >
                        <Stack spacing={3}>
                            <TextField
                                placeholder={t('username')}
                                value={auth.user}
                                onChange={e => setAuth({ ...auth, user: e.target.value })}
                                fullWidth
                                variant="outlined"
                            />
                            <TextField
                                placeholder={t('password')}
                                type="password"
                                value={auth.pass}
                                onChange={e => setAuth({ ...auth, pass: e.target.value })}
                                fullWidth
                                variant="outlined"
                            />
                            <Button type="submit" variant="contained" size="large">
                                {t('login')}
                            </Button>
                        </Stack>
                    </FormBox>
                    {error && (
                        <ErrorBox>
                            <Typography color="error.contrastText">{error}</Typography>
                        </ErrorBox>
                    )}
                    {tokenExpired && (
                        <WarningBox>
                            <Typography color="warning.contrastText">
                                {t('session_expired')}
                            </Typography>
                        </WarningBox>
                    )}
                </ContentPaper>
            </PaddedContainer>
        );
    }

    // Dashboard view
    // Dashboard view logic - now main view
    const isRootAdmin = role === 'root_admin';

    const recordsButtons = [];

    if (canManageRecords) {
        recordsButtons.push(
            <Button
                key="browse-records"
                onClick={() => {
                    if (languageSetsLoading) return;
                    if (languageSets.length === 0) {
                        setDashboard(false);
                        setLanguageSetManagement(true);
                    } else {
                        setDashboard(false);
                        setBrowseRecords(true);
                    }
                }}
                variant="contained"
                disabled={languageSetsLoading}
            >
                {t('browse_phrases')}
            </Button>
        );
    }

    recordsButtons.push(
        <Button
            key="language-sets"
            onClick={() => {
                setDashboard(false);
                setLanguageSetManagement(true);
            }}
            variant="contained"
            color="warning"
        >
            {canManageRecords
                ? t('language_sets_management')
                : t('manage_ignored_categories', 'Manage Ignored Categories')}
        </Button>
    );

    if (isRootAdmin) {
        recordsButtons.push(
            <Button
                key="duplicate-management"
                onClick={() => {
                    setDashboard(false);
                    setDuplicateManagement(true);
                }}
                variant="contained"
                color="error"
            >
                {t('duplicate_management', 'Duplicate Management')}
            </Button>
        );
    }

    // Add "Manage My Lists" button for all logged-in users
    recordsButtons.push(
        <Button
            key="manage-my-lists"
            onClick={() => {
                // Auto-select first language set if available
                if (languageSets.length > 0) {
                    setSelectedLanguageSetForLists(languageSets[0].id);
                }
                setDashboard(false);
                setListManagement(true);
            }}
            variant="contained"
            color="info"
            startIcon={<PlaylistAddCheckIcon />}
            disabled={languageSets.length === 0 || languageSetsLoading}
            title={languageSets.length === 0 ? t('no_language_sets_available', 'No language sets available') : ''}
        >
            {t('manage_my_lists')}
        </Button>
    );



    const userButtons = [];

    if (canManageAdvanced) {
        userButtons.push(
            <Button
                key="user-management"
                onClick={() => {
                    setDashboard(false);
                    setUserManagement(true);
                }}
                variant="contained"
                color="secondary"
            >
                {t('user_management')}
            </Button>
        );
    }

    userButtons.push(
        <Button
            key="user-profile"
            onClick={() => {
                setDashboard(false);
                setUserProfile(true);
            }}
            variant="contained"
            color="info"
        >
            {t('your_profile')}
        </Button>
    );

    // Learning section buttons
    const learningButtons = [
        <Button
            key="my-study-groups"
            onClick={() => {
                setDashboard(false);
                setMyStudy(true);
            }}
            variant="contained"
            color="success"
        >
            {t('student.study.title', 'My Study')}
        </Button>
    ];

    const systemButtons = [];

    if (canManageAdvanced) {
        systemButtons.push(
            <Button
                key="statistics-dashboard"
                onClick={() => {
                    setDashboard(false);
                    setStatisticsDashboard(true);
                }}
                variant="contained"
                color="success"
            >
                {t('statistics_dashboard')}
            </Button>
        );

        systemButtons.push(
            <Button
                key="system-settings"
                onClick={() => {
                    setDashboard(false);
                    setSystemSettings(true);
                }}
                variant="contained"
                color="primary"
            >
                {t('admin.settings.title')}
            </Button>
        );
    }

    const teacherButtons = [];
    if (canAccessTeacher) {
        teacherButtons.push(
            <Button
                key="teacher-mode"
                onClick={() => {
                    setDashboard(false);
                    setTeacherDashboard(true);
                }}
                variant="contained"
                color="primary"
                startIcon={<SchoolIcon />}
            >
                {t('teacher.teacher_mode', 'Teacher Mode')}
            </Button>
        );
    }

    const sections = [
        {
            key: 'learning',
            title: t('admin.dashboard.sections.learning', 'Learning'),
            buttons: learningButtons
        },
        {
            key: 'teacher',
            title: t('teacher.section_title', 'Teacher Tools'),
            buttons: teacherButtons
        },
        {
            key: 'records',
            title: t('admin.dashboard.sections.records', 'Records & Content'),
            buttons: recordsButtons
        },
        {
            key: 'users',
            title: t('admin.dashboard.sections.users', 'User & Account Tools'),
            buttons: userButtons
        },
        {
            key: 'system',
            title: t('admin.dashboard.sections.system', 'Insights & Settings'),
            buttons: systemButtons
        }
    ].filter(section => section.buttons.length > 0);

    return (
        <AdminLayout
            maxWidth={teacherDashboard || browseRecords || userManagement || statisticsDashboard || systemSettings || languageSetManagement || userProfile || duplicateManagement || listManagement ? 'xl' : 'md'}
            showBackToGame={true}
            showDashboard={!dashboard}
            showLogout={true}
            onDashboard={goToDashboard}
            onLogout={handleLogout}
            currentUser={currentUser}
            headerActions={
                <>
                    <IconButton
                        color="inherit"
                        onClick={handleNotificationClick}
                        size="large"
                        aria-label="notifications"
                    >
                        <Badge badgeContent={unreadCount} color="error">
                            <NotificationsIcon />
                        </Badge>
                    </IconButton>
                    <Popover
                        open={openNotifications}
                        anchorEl={notificationAnchorEl}
                        onClose={handleNotificationClose}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    >
                        <NotificationList
                            notifications={notifications}
                            onRead={markAsRead}
                            onDelete={deleteNotification}
                            onReadAll={markAllAsRead}
                            onNavigate={handleNotificationNavigate}
                            loading={notificationsLoading}
                        />
                    </Popover>
                </>
            }
        >
            <Box ref={containerRef} sx={{ width: '100%' }}>
                {teacherDashboard ? (
                    <TeacherDashboard
                        token={token}
                        setError={setError}
                        currentUser={currentUser}
                        languageSets={languageSets}
                        currentLanguageSetId={selectedLanguageSetId}
                    />
                ) : (
                    <>
                        {userManagement ? (
                            <UserManagement currentUser={currentUser} />
                        ) : statisticsDashboard ? (
                            <StatisticsDashboard token={token} setError={setError} currentUser={currentUser} />
                        ) : systemSettings ? (
                            <SystemSettings />
                        ) : languageSetManagement ? (
                            <LanguageSetManagement
                                currentUser={currentUser}
                                initialLanguageSets={languageSets}
                                initialCategories={categories}
                                showAdminActions={currentUser?.role === 'admin' || currentUser?.role === 'root_admin' || currentUser?.role === 'administrative'}
                            />
                        ) : userProfile ? (
                            <UserProfile currentUser={currentUser} />
                        ) : myStudy ? (
                            <MyStudy token={token} />
                        ) : duplicateManagement ? (
                            <DuplicateManagement
                                currentUser={currentUser}
                                selectedLanguageSetId={selectedLanguageSetId}
                            />
                        ) : listManagement ? (
                            <PrivateListManager
                                languageSetId={selectedLanguageSetForLists}
                                isFullPage={true}
                            />
                        ) : browseRecords ? (
                            <BrowseRecordsContainer
                                token={token}
                                currentUser={currentUser}
                                selectedLanguageSetId={selectedLanguageSetId}
                                languageSets={languageSets}
                                setSelectedLanguageSetId={setSelectedLanguageSetId}
                                categories={categories}
                                userIgnoredCategories={userIgnoredCategories}
                                ignoredCategories={ignoredCategories}
                                onUpdateUserIgnoredCategories={onUpdateUserIgnoredCategories}
                                setDashboard={setDashboard}
                                setToken={setToken}
                                setIsLogged={setIsLogged}
                                isControlBarCollapsed={isControlBarCollapsed}
                                isLayoutCompact={isLayoutCompact}
                            />
                        ) : dashboard ? (
                            // Default Dashboard View
                            <Paper sx={{ p: 4, borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <Typography variant="h4" component="h2">
                                    {t('admin_dashboard')}
                                </Typography>
                                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                                    {t('welcome_user', { username: currentUser?.username, role: currentUser?.role })}
                                </Typography>
                                <Stack spacing={4} sx={{ mt: 1 }}>
                                    {sections.map(section => (
                                        <Box key={section.key}>
                                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                                                {section.title}
                                            </Typography>
                                            <Divider sx={{ mb: 2, maxWidth: { xs: '100%', sm: 480 } }} />
                                            <Stack
                                                direction="row"
                                                spacing={1.5}
                                                flexWrap="wrap"
                                                useFlexGap
                                                justifyContent="flex-start"
                                                alignItems="center"
                                            >
                                                {section.buttons}
                                            </Stack>
                                        </Box>
                                    ))}
                                </Stack>
                                {error && (
                                    <Box sx={{ mt: 1, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
                                        <Typography color="error.contrastText">{error}</Typography>
                                    </Box>
                                )}
                            </Paper>
                        ) : null}
                    </>
                )}
            </Box>

            {/* Rate Limit Warning */}
            <RateLimitWarning
                show={showFetchRateLimit}
                onClose={() => { }} // Auto-closes via autoHideDuration
                message={t('admin.rateLimitWarning', 'Please wait before making another request. Data is being processed.')}
            />

            {/* Private List Manager Dialog */}
            {
                showListManager && selectedLanguageSetForLists && (
                    <PrivateListManager
                        open={showListManager}
                        onClose={() => {
                            setShowListManager(false);
                            setSelectedLanguageSetForLists(null);
                        }}
                        languageSetId={selectedLanguageSetForLists}
                    />
                )
            }
        </AdminLayout >
    );
}

AdminPanel.propTypes = {
    ignoredCategories: PropTypes.array,
    userIgnoredCategories: PropTypes.array,
    onUpdateUserIgnoredCategories: PropTypes.func,
};