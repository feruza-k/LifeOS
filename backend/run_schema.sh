#!/bin/bash
# Run database schema on Supabase
# 
# IMPORTANT: Never commit passwords to git!
# Set PGPASSWORD from environment variable or .env file

# Get password from environment variable (set in .env or export)
if [ -z "$PGPASSWORD" ]; then
    echo "❌ Error: PGPASSWORD not set"
    echo "Set it from your .env file or export it:"
    echo "  export PGPASSWORD='your-password-here'"
    echo ""
    echo "Or extract from DATABASE_URL:"
    echo "  export PGPASSWORD=\$(echo \$DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\\([^@]*\\)@.*/\\1/p')"
    exit 1
fi

psql -h db.nuuvagaayowrvgsbduwr.supabase.co -p 5432 -U postgres -d postgres -f database_schema.sql

