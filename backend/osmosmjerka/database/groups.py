"""Teacher groups database operations."""

import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from osmosmjerka.database.models import (
    accounts_table,
    admin_settings_table,
    teacher_group_members_table,
    teacher_groups_table,
    teacher_phrase_set_groups_table,
)
from sqlalchemy import and_, func, or_
from sqlalchemy.sql import delete, insert, select, update

# Default settings
DEFAULT_SETTINGS = {
    "tier1_group_member_limit": 10,
    "tier2_group_member_limit": 50,
    "tier1_student_group_limit": 1,
    "tier2_student_group_limit": 10,
    "invitation_expiry_days": 7,
}


class TeacherGroupsMixin:
    """Mixin class providing teacher group management methods."""

    # =========================================================================
    # Admin Settings
    # =========================================================================

    async def get_setting(self, key: str) -> Any:
        """Get a setting value, returns default if not set."""
        database = self._ensure_database()
        query = select(admin_settings_table.c.value).where(admin_settings_table.c.key == key)
        result = await database.fetch_one(query)
        if result:
            return json.loads(result["value"])
        return DEFAULT_SETTINGS.get(key)

    async def set_setting(self, key: str, value: Any, description: str = None) -> None:
        """Set a setting value."""
        database = self._ensure_database()
        # Upsert pattern
        existing = await self.get_setting(key)
        json_value = json.dumps(value)
        if existing is not None and key in DEFAULT_SETTINGS:
            # Check if it's from DB or default
            check = await database.fetch_one(
                select(admin_settings_table.c.key).where(admin_settings_table.c.key == key)
            )
            if check:
                query = (
                    update(admin_settings_table)
                    .where(admin_settings_table.c.key == key)
                    .values(value=json_value, updated_at=func.now())
                )
                await database.execute(query)
                return
        query = insert(admin_settings_table).values(key=key, value=json_value, description=description)
        await database.execute(query)

    async def get_group_member_limit(self, teacher_id: int) -> int:
        """Get max group members for a teacher based on their tier."""
        database = self._ensure_database()
        query = select(accounts_table.c.account_tier).where(accounts_table.c.id == teacher_id)
        result = await database.fetch_one(query)
        tier = result["account_tier"] if result else "tier1"
        if tier == "tier2":
            return await self.get_setting("tier2_group_member_limit")
        return await self.get_setting("tier1_group_member_limit")

    async def get_student_group_limit(self, user_id: int) -> int:
        """Get max groups a student can join based on their tier."""
        database = self._ensure_database()
        query = select(accounts_table.c.account_tier).where(accounts_table.c.id == user_id)
        result = await database.fetch_one(query)
        tier = result["account_tier"] if result else "tier1"
        if tier == "tier2":
            return await self.get_setting("tier2_student_group_limit")
        return await self.get_setting("tier1_student_group_limit")

    # =========================================================================
    # Teacher Group CRUD
    # =========================================================================

    async def get_teacher_groups(self, teacher_id: int) -> List[Dict[str, Any]]:
        """Get all groups for a teacher with member counts by status."""
        database = self._ensure_database()

        # Subquery to count accepted members
        accepted_counts = (
            select(
                teacher_group_members_table.c.group_id,
                func.count(teacher_group_members_table.c.user_id).label("accepted_count"),
            )
            .where(teacher_group_members_table.c.status == "accepted")
            .group_by(teacher_group_members_table.c.group_id)
            .alias("accepted")
        )

        # Subquery to count pending invitations
        pending_counts = (
            select(
                teacher_group_members_table.c.group_id,
                func.count(teacher_group_members_table.c.user_id).label("pending_count"),
            )
            .where(teacher_group_members_table.c.status == "pending")
            .group_by(teacher_group_members_table.c.group_id)
            .alias("pending")
        )

        query = (
            select(
                teacher_groups_table.c.id,
                teacher_groups_table.c.name,
                teacher_groups_table.c.created_at,
                func.coalesce(accepted_counts.c.accepted_count, 0).label("accepted_count"),
                func.coalesce(pending_counts.c.pending_count, 0).label("pending_count"),
            )
            .outerjoin(accepted_counts, teacher_groups_table.c.id == accepted_counts.c.group_id)
            .outerjoin(pending_counts, teacher_groups_table.c.id == pending_counts.c.group_id)
            .where(teacher_groups_table.c.teacher_id == teacher_id)
            .order_by(teacher_groups_table.c.name)
        )

        result = await database.fetch_all(query)
        return [dict(row) for row in result]

    async def create_teacher_group(self, teacher_id: int, name: str) -> int:
        """Create a new teacher group."""
        database = self._ensure_database()
        query = insert(teacher_groups_table).values(teacher_id=teacher_id, name=name)
        return await database.execute(query)

    async def delete_teacher_group(self, group_id: int, teacher_id: int) -> bool:
        """Delete a teacher group if owned by teacher."""
        database = self._ensure_database()
        query = delete(teacher_groups_table).where(
            teacher_groups_table.c.id == group_id,
            teacher_groups_table.c.teacher_id == teacher_id,
        )
        await database.execute(query)
        return True

    async def get_teacher_group_by_id(self, group_id: int, teacher_id: int) -> Optional[Dict[str, Any]]:
        """Get group details if owned by teacher."""
        database = self._ensure_database()
        query = select(teacher_groups_table).where(
            teacher_groups_table.c.id == group_id,
            teacher_groups_table.c.teacher_id == teacher_id,
        )
        result = await database.fetch_one(query)
        return dict(result._mapping) if result else None

    # =========================================================================
    # Group Members (Teacher perspective)
    # =========================================================================

    async def get_group_members(self, group_id: int) -> List[Dict[str, Any]]:
        """Get all members of a group with their account details and status."""
        database = self._ensure_database()
        query = (
            select(
                accounts_table.c.id,
                accounts_table.c.username,
                teacher_group_members_table.c.status,
                teacher_group_members_table.c.invited_at,
                teacher_group_members_table.c.responded_at,
            )
            .select_from(
                teacher_group_members_table.join(
                    accounts_table,
                    teacher_group_members_table.c.user_id == accounts_table.c.id,
                )
            )
            .where(teacher_group_members_table.c.group_id == group_id)
            .order_by(teacher_group_members_table.c.status, accounts_table.c.username)
        )
        result = await database.fetch_all(query)
        return [dict(row) for row in result]

    async def get_users_in_teacher_groups(self, teacher_id: int, usernames: List[str]) -> List[int]:
        """
        Get user IDs for usernames, ONLY if they are members of the teacher's groups.
        Used for validating puzzle assignments.
        """
        if not usernames:
            return []

        database = self._ensure_database()

        # Select user IDs where:
        # 1. User has one of the provided usernames
        # 2. User is a member of a group owned by the teacher
        # 3. Membership status is 'accepted'

        query = (
            select(accounts_table.c.id)
            .distinct()  # In case user is in multiple groups
            .select_from(
                accounts_table.join(
                    teacher_group_members_table,
                    accounts_table.c.id == teacher_group_members_table.c.user_id,
                ).join(
                    teacher_groups_table,
                    teacher_group_members_table.c.group_id == teacher_groups_table.c.id,
                )
            )
            .where(
                and_(
                    accounts_table.c.username.in_(usernames),
                    teacher_groups_table.c.teacher_id == teacher_id,
                    teacher_group_members_table.c.status == "accepted",
                )
            )
        )

        result = await database.fetch_all(query)
        return [row["id"] for row in result]

    async def invite_group_member(self, group_id: int, username: str, teacher_id: int) -> Dict[str, Any]:
        """
        Invite a student to a group.
        Returns: {"success": bool, "user_id": int|None, "error": str|None}
        """
        database = self._ensure_database()

        # Validate group ownership
        group = await self.get_teacher_group_by_id(group_id, teacher_id)
        if not group:
            return {"success": False, "error": "group_not_found"}

        # Find user
        user_query = select(accounts_table.c.id, accounts_table.c.is_active).where(
            accounts_table.c.username == username
        )
        user = await database.fetch_one(user_query)
        if not user:
            return {"success": False, "error": "user_not_found"}
        if not user["is_active"]:
            return {"success": False, "error": "user_inactive"}

        user_id = user["id"]

        # Prevent teacher from adding themselves
        if user_id == teacher_id:
            return {"success": False, "error": "cannot_add_self"}

        # Check if already member or pending
        existing = await database.fetch_one(
            select(teacher_group_members_table.c.status).where(
                teacher_group_members_table.c.group_id == group_id,
                teacher_group_members_table.c.user_id == user_id,
            )
        )
        if existing:
            status = existing["status"]
            if status == "accepted":
                return {"success": False, "error": "already_member"}
            if status == "pending":
                return {"success": False, "error": "already_invited"}
            # If declined, allow re-invite by updating
            expiry = datetime.utcnow() + timedelta(days=await self.get_setting("invitation_expiry_days"))
            await database.execute(
                update(teacher_group_members_table)
                .where(
                    teacher_group_members_table.c.group_id == group_id,
                    teacher_group_members_table.c.user_id == user_id,
                )
                .values(
                    status="pending",
                    invited_at=func.now(),
                    expires_at=expiry,
                    responded_at=None,
                )
            )
            return {"success": True, "user_id": user_id}

        # Check member limit
        member_limit = await self.get_group_member_limit(teacher_id)
        current_count = await database.fetch_one(
            select(func.count(teacher_group_members_table.c.id)).where(
                teacher_group_members_table.c.group_id == group_id,
                teacher_group_members_table.c.status.in_(["pending", "accepted"]),
            )
        )
        if current_count[0] >= member_limit:
            return {"success": False, "error": "member_limit_reached"}

        # Check student group limit
        student_limit = await self.get_student_group_limit(user_id)
        student_groups = await database.fetch_one(
            select(func.count(teacher_group_members_table.c.id)).where(
                teacher_group_members_table.c.user_id == user_id,
                teacher_group_members_table.c.status == "accepted",
            )
        )
        if student_groups[0] >= student_limit:
            return {"success": False, "error": "student_group_limit_reached"}

        # Insert invitation
        expiry = datetime.utcnow() + timedelta(days=await self.get_setting("invitation_expiry_days"))
        await database.execute(
            insert(teacher_group_members_table).values(
                group_id=group_id, user_id=user_id, status="pending", expires_at=expiry
            )
        )
        return {"success": True, "user_id": user_id}

    async def remove_group_member(self, group_id: int, user_id: int) -> None:
        """Remove a student from a group."""
        database = self._ensure_database()
        query = delete(teacher_group_members_table).where(
            teacher_group_members_table.c.group_id == group_id,
            teacher_group_members_table.c.user_id == user_id,
        )
        await database.execute(query)

    # =========================================================================
    # Student Group Operations
    # =========================================================================

    async def get_student_groups(self, user_id: int) -> List[Dict[str, Any]]:
        """Get groups that a student is a member of (accepted only)."""
        database = self._ensure_database()
        query = (
            select(
                teacher_groups_table.c.id,
                teacher_groups_table.c.name,
                teacher_group_members_table.c.responded_at.label("joined_at"),
                accounts_table.c.username.label("teacher_username"),
            )
            .select_from(
                teacher_group_members_table.join(
                    teacher_groups_table,
                    teacher_group_members_table.c.group_id == teacher_groups_table.c.id,
                ).join(
                    accounts_table,
                    teacher_groups_table.c.teacher_id == accounts_table.c.id,
                )
            )
            .where(
                teacher_group_members_table.c.user_id == user_id,
                teacher_group_members_table.c.status == "accepted",
            )
            .order_by(teacher_groups_table.c.name)
        )
        result = await database.fetch_all(query)
        return [dict(row) for row in result]

    async def get_student_invitations(self, user_id: int) -> List[Dict[str, Any]]:
        """Get pending invitations for a student."""
        database = self._ensure_database()
        now = datetime.utcnow()
        query = (
            select(
                teacher_group_members_table.c.id,
                teacher_groups_table.c.id.label("group_id"),
                teacher_groups_table.c.name.label("group_name"),
                accounts_table.c.username.label("teacher_username"),
                teacher_group_members_table.c.invited_at,
                teacher_group_members_table.c.expires_at,
            )
            .select_from(
                teacher_group_members_table.join(
                    teacher_groups_table,
                    teacher_group_members_table.c.group_id == teacher_groups_table.c.id,
                ).join(
                    accounts_table,
                    teacher_groups_table.c.teacher_id == accounts_table.c.id,
                )
            )
            .where(
                teacher_group_members_table.c.user_id == user_id,
                teacher_group_members_table.c.status == "pending",
                or_(
                    teacher_group_members_table.c.expires_at.is_(None),
                    teacher_group_members_table.c.expires_at > now,
                ),
            )
            .order_by(teacher_group_members_table.c.invited_at.desc())
        )
        result = await database.fetch_all(query)
        return [dict(row) for row in result]

    async def respond_to_invitation(self, invitation_id: int, user_id: int, accept: bool) -> Dict[str, Any]:
        """Accept or decline an invitation. Returns group_id and teacher_id for notification."""
        database = self._ensure_database()

        # Get invitation details
        query = (
            select(
                teacher_group_members_table.c.group_id,
                teacher_group_members_table.c.user_id,
                teacher_group_members_table.c.status,
                teacher_group_members_table.c.expires_at,
                teacher_groups_table.c.teacher_id,
                teacher_groups_table.c.name.label("group_name"),
            )
            .select_from(
                teacher_group_members_table.join(
                    teacher_groups_table,
                    teacher_group_members_table.c.group_id == teacher_groups_table.c.id,
                )
            )
            .where(teacher_group_members_table.c.id == invitation_id)
        )
        invite = await database.fetch_one(query)

        if not invite:
            return {"success": False, "error": "invitation_not_found"}
        if invite["user_id"] != user_id:
            return {"success": False, "error": "not_your_invitation"}
        if invite["status"] != "pending":
            return {"success": False, "error": "already_responded"}
        if invite["expires_at"] and invite["expires_at"] < datetime.utcnow():
            return {"success": False, "error": "invitation_expired"}

        # If accepting, check student group limit again
        if accept:
            student_limit = await self.get_student_group_limit(user_id)
            student_groups = await database.fetch_one(
                select(func.count(teacher_group_members_table.c.id)).where(
                    teacher_group_members_table.c.user_id == user_id,
                    teacher_group_members_table.c.status == "accepted",
                )
            )
            if student_groups[0] >= student_limit:
                return {"success": False, "error": "student_group_limit_reached"}

        new_status = "accepted" if accept else "declined"
        await database.execute(
            update(teacher_group_members_table)
            .where(teacher_group_members_table.c.id == invitation_id)
            .values(status=new_status, responded_at=func.now())
        )

        return {
            "success": True,
            "group_id": invite["group_id"],
            "group_name": invite["group_name"],
            "teacher_id": invite["teacher_id"],
            "accepted": accept,
        }

    async def leave_group(self, group_id: int, user_id: int) -> Dict[str, Any]:
        """Student leaves a group. Returns teacher_id for notification."""
        database = self._ensure_database()

        # Get group info
        query = (
            select(
                teacher_group_members_table.c.id,
                teacher_groups_table.c.teacher_id,
                teacher_groups_table.c.name.label("group_name"),
            )
            .select_from(
                teacher_group_members_table.join(
                    teacher_groups_table,
                    teacher_group_members_table.c.group_id == teacher_groups_table.c.id,
                )
            )
            .where(
                teacher_group_members_table.c.group_id == group_id,
                teacher_group_members_table.c.user_id == user_id,
                teacher_group_members_table.c.status == "accepted",
            )
        )
        membership = await database.fetch_one(query)

        if not membership:
            return {"success": False, "error": "not_a_member"}

        await self.remove_group_member(group_id, user_id)

        return {
            "success": True,
            "teacher_id": membership["teacher_id"],
            "group_name": membership["group_name"],
        }

    # =========================================================================
    # Phrase Set Group Assignment
    # =========================================================================

    async def assign_groups_to_phrase_set(self, phrase_set_id: int, group_ids: List[int]) -> None:
        """Assign groups to a phrase set for dynamic access."""
        database = self._ensure_database()
        # Clear existing
        await database.execute(
            delete(teacher_phrase_set_groups_table).where(
                teacher_phrase_set_groups_table.c.phrase_set_id == phrase_set_id
            )
        )
        # Insert new
        for gid in group_ids:
            await database.execute(
                insert(teacher_phrase_set_groups_table).values(phrase_set_id=phrase_set_id, group_id=gid)
            )

    async def get_phrase_set_groups(self, phrase_set_id: int) -> List[int]:
        """Get group IDs assigned to a phrase set."""
        database = self._ensure_database()
        query = select(teacher_phrase_set_groups_table.c.group_id).where(
            teacher_phrase_set_groups_table.c.phrase_set_id == phrase_set_id
        )
        result = await database.fetch_all(query)
        return [row["group_id"] for row in result]

    async def check_user_phrase_set_access(self, phrase_set_id: int, user_id: int) -> bool:
        """Check if a user has access to a phrase set via group membership."""
        database = self._ensure_database()
        query = (
            select(teacher_group_members_table.c.id)
            .select_from(
                teacher_phrase_set_groups_table.join(
                    teacher_group_members_table,
                    teacher_phrase_set_groups_table.c.group_id == teacher_group_members_table.c.group_id,
                )
            )
            .where(
                teacher_phrase_set_groups_table.c.phrase_set_id == phrase_set_id,
                teacher_group_members_table.c.user_id == user_id,
                teacher_group_members_table.c.status == "accepted",
            )
            .limit(1)
        )
        result = await database.fetch_one(query)
        return result is not None
