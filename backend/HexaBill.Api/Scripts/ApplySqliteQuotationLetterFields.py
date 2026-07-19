import sqlite3
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "hexabill.db"
c = sqlite3.connect(p)
cur = c.cursor()

def cols(t):
    return {r[1] for r in cur.execute(f"PRAGMA table_info({t})")}

q = cols("Quotations")
qi = cols("QuotationItems")
alters = []
if "Salutation" not in q:
    alters.append("ALTER TABLE Quotations ADD COLUMN Salutation TEXT NULL")
if "IntroLine" not in q:
    alters.append("ALTER TABLE Quotations ADD COLUMN IntroLine TEXT NULL")
if "ClosingLine" not in q:
    alters.append("ALTER TABLE Quotations ADD COLUMN ClosingLine TEXT NULL")
if "DescriptionSubtitle" not in qi:
    alters.append("ALTER TABLE QuotationItems ADD COLUMN DescriptionSubtitle TEXT NULL")

for a in alters:
    print("RUN", a)
    cur.execute(a)

try:
    cur.execute("SELECT name FROM sqlite_master WHERE name='__EFMigrationsHistory'")
    if cur.fetchone():
        mid = "20260719190000_AddQuotationLetterFields"
        cur.execute("SELECT 1 FROM __EFMigrationsHistory WHERE MigrationId=?", (mid,))
        if not cur.fetchone():
            cur.execute(
                "INSERT INTO __EFMigrationsHistory (MigrationId, ProductVersion) VALUES (?,?)",
                (mid, "9.0.0"),
            )
            print("history inserted")
except Exception as e:
    print("history skip", e)

c.commit()
c.close()
print("sqlite ok", "alters", len(alters))
