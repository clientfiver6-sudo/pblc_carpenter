#!/bin/bash

source ./Docker/scripts/env_functions.sh

if [ "$DOCKER_ENV" != "true" ]; then
    export_env_vars
fi

if [[ "$DATABASE_PROVIDER" == "postgresql" || "$DATABASE_PROVIDER" == "mysql" || "$DATABASE_PROVIDER" == "psql_bouncer" ]]; then
    export DATABASE_URL
    echo "Deploying migrations for $DATABASE_PROVIDER"
    echo "Database URL: $DATABASE_URL"
    # rm -rf ./prisma/migrations
    # cp -r ./prisma/$DATABASE_PROVIDER-migrations ./prisma/migrations
    npm run db:deploy 2>&1
    DEPLOY_EXIT=$?
    if [ $DEPLOY_EXIT -ne 0 ]; then
        echo "Initial migration failed — checking if baseline is needed..."
        # Determine the correct schema file and migrations directory
        case "$DATABASE_PROVIDER" in
            psql_bouncer) SCHEMA_FILE="./prisma/postgresql-schema.prisma" ;;
            *) SCHEMA_FILE="./prisma/${DATABASE_PROVIDER}-schema.prisma" ;;
        esac
        MIGRATIONS_DIR="./prisma/migrations"

        # Baseline: mark every existing migration as already applied
        if [ -d "$MIGRATIONS_DIR" ]; then
            echo "Baselining existing migrations..."
            for migration_dir in "$MIGRATIONS_DIR"/*/; do
                migration_name=$(basename "$migration_dir")
                echo "  Resolving: $migration_name"
                npx prisma migrate resolve --applied "$migration_name" --schema "$SCHEMA_FILE" 2>&1
            done
            echo "Baseline complete. Retrying migrate deploy..."
            npm run db:deploy
            if [ $? -ne 0 ]; then
                echo "Migration failed even after baseline"
                exit 1
            else
                echo "Migration succeeded after baseline"
            fi
        else
            echo "No migrations directory found at $MIGRATIONS_DIR"
            exit 1
        fi
    else
        echo "Migration succeeded"
    fi
    npm run db:generate
    if [ $? -ne 0 ]; then
        echo "Prisma generate failed"
        exit 1
    else
        echo "Prisma generate succeeded"
    fi
else
    echo "Error: Database provider $DATABASE_PROVIDER invalid."
    exit 1
fi
