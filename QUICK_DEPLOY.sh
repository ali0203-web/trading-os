#!/bin/bash
# QUICK DEPLOY - Option A: Using Supabase CLI + GitHub
# Run this after: supabase login

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         PHASE 3: QUICK AUTONOMOUS DEPLOYMENT              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check Supabase authentication
if ! supabase projects list > /dev/null 2>&1; then
    echo "❌ Supabase authentication required"
    echo ""
    echo "Run this first in your terminal:"
    echo "  $ supabase login"
    echo ""
    echo "Then run this script again"
    exit 1
fi

echo "✅ Supabase authenticated"
echo ""

# Step 1: Deploy Supabase schema
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1: Deploying Supabase Schema"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Get first Supabase project
PROJECT_ID=$(supabase projects list --json | jq -r '.[0].id // empty')

if [ -z "$PROJECT_ID" ]; then
    echo "❌ No Supabase project found"
    echo ""
    echo "Create a project at: https://supabase.com"
    echo "Then run: supabase projects list"
    exit 1
fi

echo "Using project: $PROJECT_ID"
echo ""

# Deploy schema
echo "Deploying database schema..."
supabase db push --project-ref "$PROJECT_ID" <<EOF
$(cat supabase-schema.sql)
EOF

echo "✅ Supabase schema deployed"
echo ""

# Step 2: Git push to GitHub
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2: Pushing to GitHub"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if SSH key works
if ssh -T git@github.com &> /dev/null; then
    echo "✅ SSH key configured"
    git push origin main
    echo "✅ Code pushed to GitHub"
elif [ -n "$GITHUB_TOKEN" ]; then
    echo "Using GitHub token..."
    git remote set-url origin "https://$GITHUB_TOKEN@github.com/$(git config --get remote.origin.url | sed 's/.*github.com[/:]//')"
    git push origin main
    echo "✅ Code pushed to GitHub"
else
    echo "⚠️  Git authentication needed"
    echo ""
    echo "Option 1: Set up SSH key"
    echo "  $ ssh-keygen -t ed25519"
    echo "  Add to: https://github.com/settings/keys"
    echo ""
    echo "Option 2: Use GitHub token"
    echo "  export GITHUB_TOKEN='your-token'"
    echo "  Then run this script again"
    exit 1
fi

echo ""

# Step 3: Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Check Supabase: https://supabase.com/dashboard"
echo "2. Verify 6 tables created"
echo "3. Vercel auto-deploys on GitHub push (~5 min)"
echo "4. Get dashboard URL from: https://vercel.com"
echo "5. Set environment variables in Vercel"
echo ""
echo "Go live:"
echo "$ npm run dev"
echo ""
