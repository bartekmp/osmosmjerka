import CookieConsent from 'react-cookie-consent';
import { useTranslation } from 'react-i18next';

/**
 * Cookie consent bar component that displays at the bottom of the page.
 * Uses react-cookie-consent for handling the consent logic and cookie storage.
 * Integrates with i18next for translations.
 */
const CookieConsentBar = () => {
    const { t } = useTranslation();

    return (
        <CookieConsent
            location="bottom"
            buttonText={t('cookies.accept')}
            cookieName="osmosmjerka_cookie_consent"
            style={{
                background: 'rgba(33, 33, 33, 0.95)',
                fontSize: '14px',
                padding: '12px 20px',
                alignItems: 'center',
                zIndex: 9999,
            }}
            buttonStyle={{
                background: '#1976d2',
                color: '#ffffff',
                fontSize: '14px',
                borderRadius: '4px',
                padding: '8px 24px',
                fontWeight: 500,
                cursor: 'pointer',
            }}
            expires={365}
        >
            {t('cookies.message')}
        </CookieConsent>
    );
};

export default CookieConsentBar;
