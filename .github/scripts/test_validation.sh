#!/bin/bash

# Test script to demonstrate the validation locally
# This simulates what would happen in different scenarios

echo "🧪 Testing Branch and Commit Format Validation"
echo "==============================================="

echo ""
echo "📋 Current semantic release configuration:"
echo "Allowed tags from pyproject.toml:"
python3 -c "
import toml
try:
    with open('pyproject.toml', 'r') as f:
        config = toml.load(f)
    allowed_tags = config['tool']['semantic_release']['commit_parser_options']['allowed_tags']
    print('  ' + ', '.join(sorted(allowed_tags)))
except Exception as e:
    print(f'  Error: {e}')
    print('  Install toml: pip install toml')
"

echo ""
echo "🌿 Current branch: $(git branch --show-current)"
echo "📝 Last commit message: $(git log -1 --pretty=format:'%s')"

echo ""
echo "✅ VALID branch name examples:"
echo "  feat/user-authentication"
echo "  fix/login-bug"
echo "  docs/update-readme"
echo "  chore/update-dependencies"
echo "  main"
echo "  develop"

echo ""
echo "❌ INVALID branch name examples:"
echo "  feature-branch (missing type prefix)"
echo "  bugfix (missing slash separator)"
echo "  random/fix (wrong type)"

echo ""
echo "✅ VALID commit message examples:"
echo "  feat: add user authentication"
echo "  fix: resolve login issue"
echo "  docs: update README"
echo "  chore(deps): update dependencies"
echo "  fix(auth): handle empty password field"

echo ""
echo "❌ INVALID commit message examples:"
echo "  Add user authentication (missing type prefix)"
echo "  feature: add auth (wrong type)"
echo "  fix resolve issue (missing colon)"

echo ""
echo "🚀 To test the validation manually:"
echo "  python3 .github/scripts/validate_format.py"
echo ""
echo "📚 For more info on conventional commits:"
echo "  https://www.conventionalcommits.org/"