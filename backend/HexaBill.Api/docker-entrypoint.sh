#!/bin/bash
set -e

echo "========================================="
echo "HexaBill.Api Docker Entrypoint"
echo "========================================="

# Wait for PostgreSQL to be ready if using PostgreSQL
if [ "$USE_POSTGRES" = "true" ]; then
    echo "Waiting for PostgreSQL to be ready..."
    
    # Priority 1: Use DATABASE_URL (standard for Render)
    if [ -n "$DATABASE_URL" ]; then
        # Parse DATABASE_URL: postgres://user:password@host:port/db
        # Get the part after 'postgres://'
        proto_removed="${DATABASE_URL#*://}"
        # Get user:password part (before '@')
        userpass="${proto_removed%%@*}"
        # Get host:port/db part (after '@')
        hostportdb="${proto_removed#*@}"
        
        # Parse user and password
        DB_USER="${userpass%%:*}"
        DB_PASSWORD="${userpass#*:}"
        
        # Parse host:port and db
        hostport="${hostportdb%%/*}"
        DB_NAME="${hostportdb#*/}"
        
        # Parse host and port
        if [[ $hostport == *":"* ]]; then
            POSTGRES_HOST="${hostport%%:*}"
            POSTGRES_PORT="${hostport#*:}"
        else
            POSTGRES_HOST="$hostport"
            POSTGRES_PORT="5432"
        fi
        
        echo "Parsed from DATABASE_URL -> Host: $POSTGRES_HOST, Port: $POSTGRES_PORT"
        
        # Export connection string for dotnet ef
        if [ -z "$ConnectionStrings__DefaultConnection" ]; then
            export ConnectionStrings__DefaultConnection="Host=$POSTGRES_HOST;Port=$POSTGRES_PORT;Database=$DB_NAME;Username=$DB_USER;Password=$DB_PASSWORD;Pooling=true;"
            echo "Exported ConnectionStrings__DefaultConnection for migrations"
        fi

    # Priority 2: Use ConnectionStrings__DefaultConnection
    elif [ -n "$ConnectionStrings__DefaultConnection" ]; then
        POSTGRES_HOST=$(echo $ConnectionStrings__DefaultConnection | grep -oP 'Host=\K[^;]+' || echo "postgres")
        POSTGRES_PORT=$(echo $ConnectionStrings__DefaultConnection | grep -oP 'Port=\K[^;]+' || echo "5432")
        echo "Parsed from DefaultConnection -> Host: $POSTGRES_HOST, Port: $POSTGRES_PORT"
    
    else
        POSTGRES_HOST="postgres"
        POSTGRES_PORT="5432"
        echo "Using default values -> Host: $POSTGRES_HOST, Port: $POSTGRES_PORT"
    fi
    
    # Wait for PostgreSQL (max 60 seconds)
    timeout=60
    elapsed=0
    
    until timeout 1 bash -c "cat < /dev/null > /dev/tcp/$POSTGRES_HOST/$POSTGRES_PORT" 2>/dev/null; do
        echo "Waiting for PostgreSQL... ($elapsed/$timeout seconds)"
        sleep 2
        elapsed=$((elapsed + 2))
        
        if [ $elapsed -ge $timeout ]; then
            echo "ERROR: PostgreSQL not ready after $timeout seconds"
            echo "Host checked: $POSTGRES_HOST"
            echo "Port checked: $POSTGRES_PORT"
            exit 1
        fi
    done
    
    echo "PostgreSQL is ready!"
    
    # Run migrations if APPLY_MIGRATIONS is true
    if [ "$APPLY_MIGRATIONS" = "true" ]; then
        echo "Applying database migrations..."
        dotnet ef database update --no-build || {
            echo "WARNING: Migration failed, but continuing..."
        }
    fi
else
    echo "Using SQLite database"
fi

echo "Starting HexaBill.Api..."
echo "========================================="

# Start the application
exec dotnet HexaBill.Api.dll
