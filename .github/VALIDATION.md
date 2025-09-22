# Branch and Commit Format Validation

This GitHub Action enforces consistent branch naming and commit message formats based on the semantic release configuration in `pyproject.toml`.

## How it works

The validation runs automatically on:
- Pull requests to `main` or `develop` branches
- Direct pushes to `main` or `develop` branches

## Branch Naming Rules

Branch names must follow the format: `<type>/<description>`

Where `<type>` must be one of the allowed semantic release tags:
- `feat`, `feature` - New features
- `fix`, `bugfix` - Bug fixes  
- `improvement`, `enhancement`, `patch` - Improvements
- `chore` - Maintenance tasks
- `docs` - Documentation changes
- `style` - Code style changes
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Test additions/changes
- `ci` - CI/CD changes
- `noissue` - Changes without issue tracking

**Valid examples:**
- ✅ `feat/user-authentication`
- ✅ `fix/login-bug`
- ✅ `docs/update-readme`
- ✅ `chore/update-dependencies`

**Invalid examples:**
- ❌ `feature-branch` (missing type prefix and slash)
- ❌ `bugfix` (missing slash separator)
- ❌ `random/fix` (invalid type)

**Special cases:**
- `main` and `develop` branches are always allowed

## Commit Message Rules

Commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

`<type>: <description>` or `<type>(<scope>): <description>`

Where `<type>` must be one of the same allowed semantic release tags.

**Valid examples:**
- ✅ `feat: add user authentication`
- ✅ `fix: resolve login issue`
- ✅ `docs: update README`
- ✅ `chore(deps): update dependencies`
- ✅ `fix(auth): handle empty password field`

**Invalid examples:**
- ❌ `Add user authentication` (missing type prefix)
- ❌ `feature: add auth` (invalid type)
- ❌ `fix resolve issue` (missing colon)

## Configuration

The validation rules are automatically extracted from `pyproject.toml`:

```toml
[tool.semantic_release.commit_parser_options]
allowed_tags = ["feat", "feature", "fix", "bugfix", "improvement", "enhancement", "patch", "chore", "noissue", "docs", "style", "refactor", "perf", "test", "ci"]
```

## Testing Locally

Run the test script to see examples and validate your current branch/commit:

```bash
./.github/scripts/test_validation.sh
```

To run the validation manually:

```bash
# Install required dependency
pip install toml

# Run validation
python3 .github/scripts/validate_format.py
```

## Fixing Validation Errors

### For Branch Names

If your branch name is invalid, rename it:

```bash
# Rename current branch
git branch -m <new-valid-name>

# If already pushed, delete remote branch and push new one
git push origin --delete <old-branch-name>
git push origin <new-valid-name>
```

### For Commit Messages

If your commit message is invalid, amend it:

```bash
# Amend the last commit message
git commit --amend -m "feat: your new valid message"

# If already pushed, force push (be careful!)
git push --force-with-lease
```

For multiple commits in a PR, you may need to use interactive rebase:

```bash
git rebase -i HEAD~<number-of-commits>
# Edit commit messages in the editor that opens
```

## Bypassing Validation

In exceptional cases, you can bypass the validation by:

1. Adding `[skip ci]` to your commit message (skips all CI)
2. Using a different target branch temporarily
3. Modifying the workflow file to exclude specific branches

However, it's recommended to follow the conventions for consistency.