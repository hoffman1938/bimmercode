#!/bin/bash

# Parts Finder Setup Script
# Run this to initialize the Parts Finder database

echo "🔧 Parts Finder Database Setup"
echo "================================"
echo ""

# Step 1: Apply migrations
echo "📦 Step 1: Applying database migrations..."
npx wrangler d1 execute DB --file=migrations/006_parts_finder.sql
if [ $? -eq 0 ]; then
    echo "✅ Migrations applied successfully"
else
    echo "❌ Migration failed"
    exit 1
fi

echo ""

# Step 2: Seed parts data
echo "📦 Step 2: Loading parts data..."
npx wrangler d1 execute DB --file=seed_parts.sql
if [ $? -eq 0 ]; then
    echo "✅ Parts data loaded successfully"
else
    echo "❌ Parts data failed to load"
    exit 1
fi

echo ""

# Step 3: Seed affiliate links
echo "📦 Step 3: Loading affiliate links..."
npx wrangler d1 execute DB --file=seed_affiliate_links.sql
if [ $? -eq 0 ]; then
    echo "✅ Affiliate links loaded successfully"
else
    echo "❌ Affiliate links failed to load"
    exit 1
fi

echo ""
echo "🎉 Parts Finder setup complete!"
echo ""
echo "Next steps:"
echo "1. Sign up for affiliate programs (eBay, Amazon, AliExpress)"
echo "2. Update affiliate IDs in seed_affiliate_links.sql"
echo "3. Add parts-finder.css to your HTML pages"
echo "4. Add parts-finder.js to your HTML pages"
echo ""
echo "See parts_finder_implementation.md for details"
