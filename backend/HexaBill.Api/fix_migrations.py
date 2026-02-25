import sqlite3
import os

db_path = 'hexabill.db'

if not os.path.exists(db_path):
    print(f"Error: Database file '{db_path}' not found.")
    exit(1)

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    migrations = [
        ('20260218024142_AddExpenseRouteId', '9.0.0'),
        ('20260219062317_AddDamageCategoriesAndReturnExtensions', '9.0.0')
    ]

    print(f"Checking migrations for {db_path}...")
    
    for migration_id, product_version in migrations:
        try:
            # Check if migration already exists
            cursor.execute('SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = ?', (migration_id,))
            exists = cursor.fetchone()
            
            if exists:
                print(f"Migration already exists in history: {migration_id}")
            else:
                cursor.execute('INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion") VALUES (?, ?)', (migration_id, product_version))
                print(f"Inserted migration into history: {migration_id}")
        except Exception as e:
            print(f"Error processing {migration_id}: {e}")

    conn.commit()
    print("Migration history update completed.")
    
    conn.close()

except Exception as e:
    print(f"Database connection error: {e}")
