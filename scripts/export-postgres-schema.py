"""Read-only PostgreSQL schema reference; never exports application records or credentials.

Requires psycopg2. Supply a protected PG* environment file with --env-file,
or set the normal libpq PG* variables. Do not put passwords on the command line.
"""
import argparse
import os
from pathlib import Path
import psycopg2


def cell(value):
    return str(value if value is not None else '').replace('|', r'\|').replace('\n', ' ')


def export(env_file, output):
    if env_file:
        for line in Path(env_file).read_text().splitlines():
            if line and not line.startswith('#'):
                key, value = line.split('=', 1)
                if key not in {'PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGSSLMODE', 'PGCONNECT_TIMEOUT'}:
                    raise ValueError('Unexpected environment key; only libpq connection settings are accepted')
                os.environ[key] = value
    with psycopg2.connect(connect_timeout=15) as connection:
        connection.set_session(readonly=True, isolation_level='REPEATABLE READ')
        with connection.cursor() as q:
            q.execute("SET LOCAL statement_timeout='30s'; SET LOCAL TIME ZONE 'UTC'")
            q.execute('SELECT current_database(), current_setting(\'server_version\'), now()')
            database, version, captured = q.fetchone()
            q.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
            tables = [r[0] for r in q.fetchall()]
            q.execute("SELECT count(*) FROM information_schema.columns WHERE table_schema='public'")
            columns = q.fetchone()[0]
            lines = ['# Live PostgreSQL schema reference', '',
                f'Captured: {captured.isoformat()}. Database: `{database}`. PostgreSQL: `{version}`.', '',
                f'Public tables: **{len(tables)}**. Columns: **{columns}**.', '',
                'Read-only catalog inspection. IDs below describe primary/foreign keys and identity sequences; '
                'customer, staff and financial records, live row IDs, credentials and stored document contents are excluded.', '',
                '## Migration history', '', '| Migration ID | EF version |', '|---|---|']
            q.execute('SELECT "MigrationId", "ProductVersion" FROM "__EFMigrationsHistory" ORDER BY "MigrationId"')
            lines += ['| ' + ' | '.join(map(cell, r)) + ' |' for r in q.fetchall()]
            for table in tables:
                lines += ['', f'## {table}', '', '| Field | PostgreSQL type | Nullable | Default | Identity |', '|---|---|---|---|---|']
                q.execute('''SELECT column_name, CASE WHEN data_type='character varying' THEN 'varchar(' || character_maximum_length || ')'
                    WHEN data_type='numeric' AND numeric_precision IS NOT NULL THEN 'numeric(' || numeric_precision || ',' || numeric_scale || ')'
                    ELSE data_type END, is_nullable, column_default, is_identity
                    FROM information_schema.columns WHERE table_schema='public' AND table_name=%s ORDER BY ordinal_position''', (table,))
                lines += ['| ' + ' | '.join(map(cell, r)) + ' |' for r in q.fetchall()]
                q.execute('''SELECT con.conname, pg_get_constraintdef(con.oid) FROM pg_constraint con
                    JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
                    WHERE n.nspname='public' AND c.relname=%s ORDER BY con.conname''', (table,))
                constraints = q.fetchall()
                if constraints:
                    lines += ['', '| Constraint | Definition |', '|---|---|']
                    lines += ['| '+cell(n)+' | '+cell(d)+' |' for n, d in constraints]
                q.execute("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=%s ORDER BY indexname", (table,))
                indexes = q.fetchall()
                if indexes:
                    lines += ['', '| Index | Definition |', '|---|---|']
                    lines += ['| '+cell(n)+' | '+cell(d)+' |' for n, d in indexes]
            q.execute("SELECT sequencename, data_type, start_value, min_value, max_value, increment_by, cycle FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename")
            lines += ['', '## Identity sequences', '', '| Name | Type | Start | Minimum | Maximum | Increment | Cycles |', '|---|---|---|---|---|---|---|']
            lines += ['| '+' | '.join(map(cell, r))+' |' for r in q.fetchall()]
            q.execute("SELECT event_object_table, trigger_name, action_timing, event_manipulation FROM information_schema.triggers WHERE trigger_schema='public' ORDER BY event_object_table,trigger_name,event_manipulation")
            triggers = q.fetchall()
            lines += ['', '## Triggers', '', '| Table | Trigger | Timing | Event |', '|---|---|---|---|']
            lines += ['| '+' | '.join(map(cell, r))+' |' for r in triggers] or ['| None | | | |']
    target = Path(output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text('\n'.join(lines)+'\n', encoding='utf-8')
    print(f'Schema reference saved: {target} ({len(tables)} tables, {columns} columns; no record export)')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    export(args.env_file, args.output)
