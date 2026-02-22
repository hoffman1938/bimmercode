#!/bin/bash

echo "🗑️  Clearing existing parts data..."
npx wrangler d1 execute DB --file=clear_parts.sql

if [ $? -eq 0 ]; then
    echo "✅ Cleared successfully"
    echo ""
    echo "📦 Loading new parts data..."
    npx wrangler d1 execute DB --file=seed_all_parts.sql
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 Parts data loaded successfully!"
        echo ""
        echo "📊 Summary:"
        echo "   - 112 parts loaded"
        echo "   - 336 affiliate links loaded"
        echo "   - Covers 74 BMW error codes"
        echo ""
        echo "✨ Parts Finder is now ready!"
    else
        echo "❌ Failed to load parts data"
        exit 1
    fi
else
    echo "❌ Failed to clear existing data"
    exit 1
fi
