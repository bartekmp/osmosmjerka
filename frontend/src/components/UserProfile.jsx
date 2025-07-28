import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Alert,
  Chip,
  Divider,
  Grid
} from '@mui/material';
import axios from 'axios';

const UserProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Profile editing
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileData, setProfileData] = useState({ self_description: '' });
  
  // Password change
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/admin/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(response.data);
      setProfileData({ self_description: response.data.self_description || '' });
    } catch (err) {
      setError('Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put('/admin/profile', profileData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Profile updated successfully');
      setEditProfileOpen(false);
      fetchProfile();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('New passwords do not match');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post('/admin/change-password', {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Password changed successfully');
      setChangePasswordOpen(false);
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    }
  };

  const getRoleChip = (role) => {
    const colors = {
      'root_admin': 'error',
      'administrative': 'warning',
      'regular': 'default'
    };
    const labels = {
      'root_admin': 'Root Admin',
      'administrative': 'Administrative',
      'regular': 'Regular User'
    };
    return <Chip label={labels[role]} color={colors[role]} />;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <Typography>Loading profile...</Typography>
      </Box>
    );
  }

  if (!profile) {
    return (
      <Box p={3}>
        <Alert severity="error">Failed to load profile</Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        User Profile
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Profile Information
              </Typography>
              
              <Box mb={2}>
                <Typography variant="body2" color="textSecondary">
                  Username
                </Typography>
                <Typography variant="body1" fontWeight="bold">
                  {profile.username}
                </Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="body2" color="textSecondary">
                  Role
                </Typography>
                <Box mt={1}>
                  {getRoleChip(profile.role)}
                </Box>
              </Box>

              <Box mb={2}>
                <Typography variant="body2" color="textSecondary">
                  Description
                </Typography>
                <Typography variant="body1">
                  {profile.self_description || 'No description provided'}
                </Typography>
              </Box>

              {profile.created_at && (
                <Box mb={2}>
                  <Typography variant="body2" color="textSecondary">
                    Member Since
                  </Typography>
                  <Typography variant="body1">
                    {new Date(profile.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
              )}

              {profile.last_login && (
                <Box mb={2}>
                  <Typography variant="body2" color="textSecondary">
                    Last Login
                  </Typography>
                  <Typography variant="body1">
                    {new Date(profile.last_login).toLocaleDateString()}
                  </Typography>
                </Box>
              )}

              <Divider sx={{ my: 2 }} />

              <Box display="flex" gap={2}>
                {profile.role !== 'root_admin' && (
                  <>
                    <Button 
                      variant="outlined" 
                      onClick={() => setEditProfileOpen(true)}
                    >
                      Edit Profile
                    </Button>
                    <Button 
                      variant="outlined" 
                      onClick={() => setChangePasswordOpen(true)}
                    >
                      Change Password
                    </Button>
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Edit Profile Dialog */}
      <Dialog open={editProfileOpen} onClose={() => setEditProfileOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Profile</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Description"
            type="text"
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={profileData.self_description}
            onChange={(e) => setProfileData({ ...profileData, self_description: e.target.value })}
            helperText="Tell others about yourself"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditProfileOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateProfile} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Current Password"
            type="password"
            fullWidth
            variant="outlined"
            value={passwordData.current_password}
            onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
          />
          <TextField
            margin="dense"
            label="New Password"
            type="password"
            fullWidth
            variant="outlined"
            value={passwordData.new_password}
            onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Confirm New Password"
            type="password"
            fullWidth
            variant="outlined"
            value={passwordData.confirm_password}
            onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangePasswordOpen(false)}>Cancel</Button>
          <Button onClick={handleChangePassword} variant="contained">Change Password</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserProfile;
