import { render, screen } from '@testing-library/react';

// Mock react-i18next
jest.mock('react-i18next', () => ({
    ...jest.requireActual('react-i18next'),
    useTranslation: () => ({ t: (key, _) => key })
}));

import TeacherDashboard from '../TeacherDashboard';

describe('TeacherDashboard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock clipboard
        Object.defineProperty(navigator, 'clipboard', {
            value: {
                writeText: jest.fn(() => Promise.resolve()),
            },
            writable: true,
        });
        // Setup default fetch mock
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ sets: [], total: 0 }),
            })
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders loading state initially', () => {
        render(<TeacherDashboard token="test-token" languageSets={[]} currentLanguageSetId={1} />);
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    test('calls fetch on mount', () => {
        render(<TeacherDashboard token="test-token" languageSets={[]} currentLanguageSetId={1} />);

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/admin/teacher/phrase-sets'),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer test-token',
                }),
            })
        );
    });

    test('renders without crashing with props', () => {
        const { container } = render(
            <TeacherDashboard
                token="test-token"
                languageSets={[{ id: 1, name: 'Spanish' }]}
                currentLanguageSetId={1}
            />
        );
        expect(container).toBeInTheDocument();
    });

});
