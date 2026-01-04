"""Main DatabaseManager class that composes all database modules."""

from typing import Optional

from osmosmjerka.database.accounts import AccountsMixin
from osmosmjerka.database.base import BaseDatabaseManager
from osmosmjerka.database.game_sessions import GameSessionsMixin
from osmosmjerka.database.language_sets import LanguageSetsMixin
from osmosmjerka.database.list_sharing import ListSharingMixin
from osmosmjerka.database.notifications import NotificationsMixin
from osmosmjerka.database.phrases import PhrasesMixin
from osmosmjerka.database.private_lists import PrivateListsMixin
from osmosmjerka.database.scoring import ScoringMixin
from osmosmjerka.database.statistics import StatisticsMixin
from osmosmjerka.database.teacher_sets import TeacherSetsMixin
from osmosmjerka.database.user_preferences import UserPreferencesMixin


class DatabaseManager(
    BaseDatabaseManager,
    AccountsMixin,
    LanguageSetsMixin,
    PhrasesMixin,
    UserPreferencesMixin,
    GameSessionsMixin,
    StatisticsMixin,
    ScoringMixin,
    PrivateListsMixin,
    ListSharingMixin,
    TeacherSetsMixin,
    NotificationsMixin,
):
    """Database manager class that encapsulates all database operations using hybrid approach.

    This class composes functionality from multiple mixin classes, each handling
    a specific domain of database operations.
    """

    def __init__(self, database_url: Optional[str] = None):
        super().__init__(database_url)


# Create global database manager instance
db_manager = DatabaseManager()
