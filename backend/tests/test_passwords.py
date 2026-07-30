import bcrypt
import pytest
from osmosmjerka.passwords import (
    MIN_PASSWORD_LENGTH,
    PasswordPolicyError,
    hash_password,
    needs_rehash,
    validate_password,
    verify_password,
)

GOOD_PASSWORD = "a-decent-passphrase"


class TestHashing:
    def test_hashes_with_argon2id(self):
        assert hash_password(GOOD_PASSWORD).startswith("$argon2id$")

    def test_same_password_hashes_differently(self):
        """Distinct salts, so identical passwords must not produce identical hashes."""
        assert hash_password(GOOD_PASSWORD) != hash_password(GOOD_PASSWORD)

    def test_verifies_correct_password(self):
        assert verify_password(GOOD_PASSWORD, hash_password(GOOD_PASSWORD))

    def test_rejects_wrong_password(self):
        assert not verify_password("something-else-entirely", hash_password(GOOD_PASSWORD))

    def test_fresh_argon2_hash_needs_no_rehash(self):
        assert not needs_rehash(hash_password(GOOD_PASSWORD))


class TestLegacyBcryptUpgradePath:
    """Existing accounts are bcrypt; they must keep working and be flagged for upgrade."""

    def test_verifies_legacy_bcrypt_hash(self):
        legacy = bcrypt.hashpw(GOOD_PASSWORD.encode(), bcrypt.gensalt()).decode()
        assert verify_password(GOOD_PASSWORD, legacy)

    def test_rejects_wrong_password_against_bcrypt(self):
        legacy = bcrypt.hashpw(GOOD_PASSWORD.encode(), bcrypt.gensalt()).decode()
        assert not verify_password("wrong", legacy)

    def test_bcrypt_hash_is_flagged_for_rehash(self):
        legacy = bcrypt.hashpw(GOOD_PASSWORD.encode(), bcrypt.gensalt()).decode()
        assert needs_rehash(legacy)


class TestMalformedInput:
    """A corrupt or unknown hash must deny access, never raise into the endpoint."""

    @pytest.mark.parametrize("stored", ["", "not-a-hash", "$unknown$abc", "$argon2id$truncated"])
    def test_bad_stored_hash_denies_instead_of_raising(self, stored):
        assert verify_password(GOOD_PASSWORD, stored) is False

    def test_empty_password_denies(self):
        assert verify_password("", hash_password(GOOD_PASSWORD)) is False

    def test_needs_rehash_tolerates_garbage(self):
        assert needs_rehash("not-a-hash") is False


class TestPolicy:
    def test_accepts_a_reasonable_passphrase(self):
        assert validate_password(GOOD_PASSWORD) is None

    @pytest.mark.parametrize(
        "password",
        ["", "short", "a" * (MIN_PASSWORD_LENGTH - 1), "   ", "password123", "aaaaaaaaaaaaaa"],
    )
    def test_rejects_weak_passwords(self, password):
        with pytest.raises(PasswordPolicyError):
            validate_password(password)

    def test_rejects_password_containing_email_local_part(self):
        with pytest.raises(PasswordPolicyError):
            validate_password("bartek-rules-ok", email="bartek@example.com")

    def test_rejects_password_containing_username(self):
        with pytest.raises(PasswordPolicyError):
            validate_password("my-teacher-pass", username="teacher")

    def test_short_identifiers_do_not_trigger_the_containment_rule(self):
        """A 3-char username would otherwise match far too many passwords."""
        assert validate_password("abcdefghijkl", username="abc") is None

    def test_rejects_absurdly_long_password(self):
        with pytest.raises(PasswordPolicyError):
            validate_password("x" * 2000)
