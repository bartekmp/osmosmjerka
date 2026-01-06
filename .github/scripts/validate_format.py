#!/usr/bin/env python3
"""
Validate branch naming and commit message formats according to semantic release configuration.
"""

import os
import re
import subprocess
import sys
from typing import Dict, List, Tuple

import toml


def load_semantic_release_config() -> dict:
    """Load semantic release configuration from pyproject.toml"""
    try:
        with open("pyproject.toml", "r") as f:
            config = toml.load(f)

        semantic_config = config.get("tool", {}).get("semantic_release", {})
        commit_parser_options = semantic_config.get("commit_parser_options", {})

        return {
            "allowed_tags": commit_parser_options.get("allowed_tags", []),
            "minor_tags": commit_parser_options.get("minor_tags", []),
            "patch_tags": commit_parser_options.get("patch_tags", []),
        }
    except Exception as e:
        print(f"❌ Error loading pyproject.toml: {e}")
        sys.exit(1)


def get_branch_name() -> str:
    """Get the current branch name from environment variables"""
    event_name = os.environ.get("GITHUB_EVENT_NAME", "")

    if event_name == "pull_request":
        # For pull requests, use the head ref (source branch)
        branch = os.environ.get("GITHUB_HEAD_REF", "")
    else:
        # For push events, extract from GITHUB_REF
        github_ref = os.environ.get("GITHUB_REF", "")
        if github_ref.startswith("refs/heads/"):
            branch = github_ref.replace("refs/heads/", "")
        else:
            branch = github_ref

    return branch


def validate_branch_name(branch_name: str, allowed_tags: List[str]) -> Tuple[bool, str]:
    """
    Validate branch name format.
    Expected format: <allowed_tag>/<description> or main/develop
    """
    # Allow main and develop branches
    if branch_name in ["main", "develop"]:
        return True, ""

    # Check if branch follows the format: <allowed_tag>/<description>
    if "/" not in branch_name:
        error_msg = f"""
❌ BRANCH NAME VALIDATION FAILED

Branch name: '{branch_name}'

REQUIRED FORMAT: <type>/<description>

Where <type> must be one of the allowed semantic release tags:
{', '.join(sorted(allowed_tags))}

EXAMPLES:
  ✅ feat/user-authentication
  ✅ fix/login-bug
  ✅ docs/update-readme
  ✅ chore/update-dependencies

CURRENT ISSUE: Branch name doesn't contain a forward slash (/)

TO FIX: Rename your branch to follow the format: <type>/<description>
"""
        return False, error_msg

    branch_type = branch_name.split("/")[0]

    if branch_type not in allowed_tags:
        error_msg = f"""
❌ BRANCH NAME VALIDATION FAILED

Branch name: '{branch_name}'
Branch type: '{branch_type}'

REQUIRED FORMAT: <type>/<description>

Where <type> must be one of the allowed semantic release tags:
{', '.join(sorted(allowed_tags))}

EXAMPLES:
  ✅ feat/user-authentication
  ✅ fix/login-bug
  ✅ docs/update-readme
  ✅ chore/update-dependencies

CURRENT ISSUE: '{branch_type}' is not an allowed tag

TO FIX: Rename your branch to use one of the allowed types above
"""
        return False, error_msg

    return True, ""


def get_commit_messages() -> List[Dict[str, str]]:
    """Get commit messages (subject and full body) for validation."""
    event_name = os.environ.get("GITHUB_EVENT_NAME", "")

    if event_name == "pull_request":
        # For PR, get commits in the PR
        base_ref = os.environ.get("GITHUB_BASE_REF", "main")
        head_ref = os.environ.get("GITHUB_SHA", "")

        try:
            # Get commits that are in HEAD but not in base
            result = subprocess.run(
                ["git", "rev-list", "--no-merges", f"origin/{base_ref}..{head_ref}"],
                capture_output=True,
                text=True,
                check=True,
            )

            commit_hashes = result.stdout.strip().split("\n")
            if not commit_hashes or commit_hashes == [""]:
                return []

            commit_messages: List[Dict[str, str]] = []
            for commit_hash in commit_hashes:
                subject_res = subprocess.run(
                    ["git", "log", "-1", "--pretty=format:%s", commit_hash], capture_output=True, text=True, check=True
                )
                full_res = subprocess.run(
                    ["git", "log", "-1", "--pretty=%B", commit_hash], capture_output=True, text=True, check=True
                )
                id_res = subprocess.run(
                    ["git", "log", "-1", "--pretty=format:%an|%ae|%cn|%ce", commit_hash],
                    capture_output=True,
                    text=True,
                    check=True,
                )
                commit_messages.append(
                    {
                        "subject": subject_res.stdout.strip(),
                        "full": full_res.stdout.strip(),
                        "identity": id_res.stdout.strip(),
                    }
                )

            return commit_messages

        except subprocess.CalledProcessError as e:
            print(f"Warning: Could not get PR commits: {e}")
            # Fallback to just the current commit
            msg = get_current_commit_message_full()
            ident = get_head_identity()
            return [{"subject": msg.split("\n", 1)[0].strip(), "full": msg, "identity": ident}]
    else:
        # For push events, just validate the current commit
        msg = get_current_commit_message_full()
        ident = get_head_identity()
        return [{"subject": msg.split("\n", 1)[0].strip(), "full": msg, "identity": ident}]


def get_current_commit_message_full() -> str:
    """Get the full current commit message (subject + body)"""
    try:
        result = subprocess.run(["git", "log", "-1", "--pretty=%B"], capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return ""


def get_head_identity() -> str:
    """Return a string containing author/committer name/email for HEAD."""
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--pretty=format:%an|%ae|%cn|%ce"], capture_output=True, text=True, check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return ""


def is_semantic_release_message(full_message: str) -> bool:
    """Detect if a commit message was generated by python-semantic-release.

    Expected format example:
    1.27.0\n
    Automatically generated by python-semantic-release
    """
    if not full_message:
        return False
    lines = [ln.strip() for ln in full_message.strip().splitlines()]
    if not lines:
        return False
    subject = lines[0]
    body = "\n".join(lines[1:])
    # Subject is a version like 1.27.0 (optionally allow pre-release/build metadata)
    version_re = r"^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z\.-]+)?$"
    if not re.match(version_re, subject):
        return False
    if "automatically generated by python-semantic-release" in body.lower():
        return True
    return False


def is_semantic_release_identity(identity: str) -> bool:
    """Detect if the commit author/committer identity matches semantic-release."""
    if not identity:
        return False
    ident = identity.lower()
    return "semantic-release" in ident


def validate_commit_message(commit_message: str, allowed_tags: List[str]) -> Tuple[bool, str]:
    """
    Validate commit message format.
    Expected format: <type>: <description> or <type>(<scope>): <description>
    """
    if not commit_message.strip():
        return True, ""  # Skip empty messages

    # Pattern for conventional commits: type(scope): description or type: description
    pattern = r"^(.*?)(\([^)]+\))?\s*:\s*.+"
    match = re.match(pattern, commit_message)

    if not match:
        error_msg = f"""
❌ COMMIT MESSAGE VALIDATION FAILED

Commit message: '{commit_message}'

REQUIRED FORMAT: <type>: <description> or <type>(<scope>): <description>

Where <type> must be one of the allowed semantic release tags:
{', '.join(sorted(allowed_tags))}

EXAMPLES:
  ✅ feat: add user authentication
  ✅ fix: resolve login issue
  ✅ docs: update README
  ✅ chore(deps): update dependencies
  ✅ fix(auth): handle empty password field

CURRENT ISSUE: Commit message doesn't follow conventional commit format

TO FIX: Update your commit message to follow the format: <type>: <description>
"""
        return False, error_msg

    commit_type = match.group(1).strip()

    if commit_type not in allowed_tags:
        error_msg = f"""
❌ COMMIT MESSAGE VALIDATION FAILED

Commit message: '{commit_message}'
Commit type: '{commit_type}'

REQUIRED FORMAT: <type>: <description> or <type>(<scope>): <description>

Where <type> must be one of the allowed semantic release tags:
{', '.join(sorted(allowed_tags))}

EXAMPLES:
  ✅ feat: add user authentication
  ✅ fix: resolve login issue
  ✅ docs: update README
  ✅ chore(deps): update dependencies

CURRENT ISSUE: '{commit_type}' is not an allowed tag

TO FIX: Update your commit message to use one of the allowed types above
"""
        return False, error_msg

    return True, ""


def main():
    print("🔍 Validating branch name and commit message format...")

    # Load configuration
    config = load_semantic_release_config()
    allowed_tags = config["allowed_tags"]

    if not allowed_tags:
        print("⚠️  Warning: No allowed_tags found in semantic release configuration")
        return

    print(f"📋 Allowed tags: {', '.join(sorted(allowed_tags))}")

    # Short-circuit: allow semantic-release commits regardless of branch name
    head_full_msg = get_current_commit_message_full()
    head_ident = get_head_identity()
    if is_semantic_release_message(head_full_msg) and is_semantic_release_identity(head_ident):
        print("🤖 Detected semantic-release commit. Skipping branch and commit message validation.")
        print("✅ Validation passed for semantic-release commit")
        return

    # Validate branch name
    branch_name = get_branch_name()
    print(f"🌿 Branch: {branch_name}")

    branch_valid, branch_error = validate_branch_name(branch_name, allowed_tags)

    if not branch_valid:
        print(branch_error)
        sys.exit(1)

    print("✅ Branch name format is valid")

    # Validate commit messages
    commit_messages = get_commit_messages()

    if not commit_messages:
        print("ℹ️  No commit messages to validate")
        return

    print(f"📝 Validating {len(commit_messages)} commit message(s)...")

    all_valid = True
    for i, commit in enumerate(commit_messages, 1):
        subject = commit.get("subject", "")
        full_msg = commit.get("full", subject)
        identity = commit.get("identity", "")
        print(f"  {i}. {subject}")

        # Skip validation for semantic-release generated commits (message + identity)
        if is_semantic_release_message(full_msg) and is_semantic_release_identity(identity):
            print("     ↪ Skipping semantic-release commit")
            continue

        commit_valid, commit_error = validate_commit_message(subject, allowed_tags)

        if not commit_valid:
            print(commit_error)
            all_valid = False

    if not all_valid:
        sys.exit(1)

    print("✅ All commit messages are valid")
    print("🎉 Validation completed successfully!")


if __name__ == "__main__":
    main()
