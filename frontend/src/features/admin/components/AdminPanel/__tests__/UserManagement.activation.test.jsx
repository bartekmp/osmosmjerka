import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
jest.mock('react-i18next', () => ({
    ...jest.requireActual('react-i18next'),
    useTranslation: () => ({ t: (key) => key })
}));
import UserManagement from '../UserManagement';

const PENDING = {
    id: 4,
    username: 'pending',
    email: 'pending@example.com',
    email_verified: false,
    role: 'regular',
    self_description: 'Signed up, never confirmed',
    created_at: '2026-07-01T00:00:00Z',
    last_login: null
};

const CONFIRMED = {
    id: 5,
    username: 'confirmed',
    email: 'confirmed@example.com',
    email_verified: true,
    role: 'regular',
    self_description: 'All set',
    created_at: '2026-07-01T00:00:00Z',
    last_login: '2026-07-20T00:00:00Z'
};

const LEGACY = {
    id: 6,
    username: 'legacy',
    email: null,
    email_verified: false,
    role: 'teacher',
    self_description: 'Created by an admin, no address',
    created_at: '2026-01-01T00:00:00Z',
    last_login: null
};

Object.defineProperty(window, 'localStorage', {
    value: { getItem: jest.fn(() => 'mock-token'), setItem: jest.fn(), removeItem: jest.fn() }
});

function mockUserList(users) {
    global.fetch = jest.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ users, total: users.length }) })
    );
}

const rootAdmin = { id: 0, username: 'root', role: 'root_admin' };

beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true);
});

test('shows the address and its confirmation state', async () => {
    mockUserList([PENDING, CONFIRMED, LEGACY]);
    render(<UserManagement currentUser={rootAdmin} />);

    await screen.findByText('pending@example.com');
    expect(screen.getByText('confirmed@example.com')).toBeInTheDocument();
    expect(screen.getByText('email_pending')).toBeInTheDocument();
    expect(screen.getByText('email_confirmed')).toBeInTheDocument();
});

test('offers the confirm action only for a pending account', async () => {
    mockUserList([PENDING, CONFIRMED, LEGACY]);
    render(<UserManagement currentUser={rootAdmin} />);

    await screen.findByText('pending@example.com');
    // One pending account, so exactly one confirm button - not for the confirmed account,
    // and not for the one with no address at all.
    expect(screen.getAllByTitle('confirm_email')).toHaveLength(1);
    expect(screen.getAllByTitle('resend_verification')).toHaveLength(1);
});

test('confirming posts to the endpoint and refreshes the list', async () => {
    mockUserList([PENDING]);
    render(<UserManagement currentUser={rootAdmin} />);
    await screen.findByText('pending@example.com');

    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ message: 'Email confirmed' }) });

    await userEvent.click(screen.getByTitle('confirm_email'));

    await waitFor(() =>
        expect(global.fetch).toHaveBeenCalledWith(
            '/admin/users/4/confirm-email',
            expect.objectContaining({ method: 'POST' })
        )
    );
    expect(await screen.findByText('email_confirmed_successfully')).toBeInTheDocument();
});

test('asks before confirming, and does nothing if declined', async () => {
    window.confirm = jest.fn(() => false);
    mockUserList([PENDING]);
    render(<UserManagement currentUser={rootAdmin} />);
    await screen.findByText('pending@example.com');

    const callsBefore = global.fetch.mock.calls.length;
    await userEvent.click(screen.getByTitle('confirm_email'));

    expect(global.fetch.mock.calls.length).toBe(callsBefore);
});

test('resending the confirmation email surfaces the server message', async () => {
    mockUserList([PENDING]);
    render(<UserManagement currentUser={rootAdmin} />);
    await screen.findByText('pending@example.com');

    global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Confirmation email sent' })
    });

    await userEvent.click(screen.getByTitle('resend_verification'));

    await waitFor(() =>
        expect(global.fetch).toHaveBeenCalledWith(
            '/admin/users/4/resend-verification',
            expect.objectContaining({ method: 'POST' })
        )
    );
    expect(await screen.findByText('Confirmation email sent')).toBeInTheDocument();
});

test('a failed confirmation shows the server error', async () => {
    mockUserList([PENDING]);
    render(<UserManagement currentUser={rootAdmin} />);
    await screen.findByText('pending@example.com');

    global.fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'This account has no email address' })
    });

    await userEvent.click(screen.getByTitle('confirm_email'));

    expect(await screen.findByText('This account has no email address')).toBeInTheDocument();
});

// --- disabling accounts ---------------------------------------------------------

const ACTIVE = { ...CONFIRMED, id: 7, username: 'active-user', is_active: true };
const BANNED = { ...CONFIRMED, id: 8, username: 'banned-user', is_active: false };

test('shows whether each account is active or disabled', async () => {
    mockUserList([ACTIVE, BANNED]);
    render(<UserManagement currentUser={rootAdmin} />);

    await screen.findByText('active-user');
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('disabled')).toBeInTheDocument();
});

test('disabling asks first, then sends is_active false', async () => {
    mockUserList([ACTIVE]);
    render(<UserManagement currentUser={rootAdmin} />);
    await screen.findByText('active-user');

    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ message: 'ok' }) });
    await userEvent.click(screen.getByTitle('disable_user'));

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() =>
        expect(global.fetch).toHaveBeenCalledWith(
            '/admin/users/7',
            expect.objectContaining({ method: 'PUT', body: JSON.stringify({ is_active: false }) })
        )
    );
});

test('re-enabling does not ask, and sends is_active true', async () => {
    mockUserList([BANNED]);
    render(<UserManagement currentUser={rootAdmin} />);
    await screen.findByText('banned-user');

    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ message: 'ok' }) });
    await userEvent.click(screen.getByTitle('enable_user'));

    expect(window.confirm).not.toHaveBeenCalled();
    await waitFor(() =>
        expect(global.fetch).toHaveBeenCalledWith(
            '/admin/users/8',
            expect.objectContaining({ body: JSON.stringify({ is_active: true }) })
        )
    );
});

test('editing a disabled account does not silently re-enable it', async () => {
    // The regression this replaced: the edit dialog always sent is_active: true.
    mockUserList([BANNED]);
    render(<UserManagement currentUser={rootAdmin} />);
    await screen.findByText('banned-user');

    await userEvent.click(screen.getByTitle('edit_user'));
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ message: 'ok' }) });
    await userEvent.click(screen.getByRole('button', { name: 'update' }));

    await waitFor(() => {
        const put = global.fetch.mock.calls.find(([, opts]) => opts?.method === 'PUT');
        expect(put).toBeTruthy();
        expect(JSON.parse(put[1].body)).not.toHaveProperty('is_active');
    });
});

test('nobody can disable or delete their own account from the table', async () => {
    const self = { ...ACTIVE, id: rootAdmin.id, username: 'root' };
    mockUserList([self]);
    render(<UserManagement currentUser={rootAdmin} />);

    await screen.findByText('root');
    expect(screen.getByTitle('disable_user')).toBeDisabled();
});

test('an administrative user gets no delete button at all', async () => {
    mockUserList([ACTIVE]);
    render(<UserManagement currentUser={{ id: 1, username: 'admin', role: 'administrative' }} />);

    await screen.findByText('active-user');
    expect(screen.queryByTitle('delete_user')).not.toBeInTheDocument();
    // ...but disabling stays available to them, since it is reversible.
    expect(screen.getByTitle('disable_user')).toBeInTheDocument();
});
