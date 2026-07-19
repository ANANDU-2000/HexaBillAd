# Backup Feature Verification (B3)

**Date:** 2026-07-19  
**Scope:** Read-only.  
**Surfaces:** `BackupPage.jsx`, `ComprehensiveBackupService`, `BackupController`, `DailyBackupScheduler`, POS pages.

---

## Verdict

Backup/restore is a **real** multi-path feature. POS footers have **no** “auto-backup” label. Post-sale auto-backup **does exist silently** in `SaleService` after every successful sale create.

---

## What is backed up

`CreateFullBackupAsync` → `HexaBill_Backup_Tenant{id}_{timestamp}.zip`:

| Section | Contents |
|---------|----------|
| `data/` | SQLite file or PostgreSQL dump (`pg_dump` = whole DB if available; else tenant-filtered EF) |
| `database/*.csv` | customers, sales, items, payments, expenses, products, inventory, returns, purchases |
| `invoices/` | PDFs (optional regenerate) |
| statements / reports / storage | Tenant-scoped files |
| Settings + users JSON | Tenant |
| Manifest | Metadata |

---

## Schedule & storage

| Trigger | Default |
|---------|---------|
| Manual (`/backup`) | Admin/Owner anytime |
| `DailyBackupScheduler` | **Off** (`BACKUP_SCHEDULE_ENABLED=false`); time `21:00`, retention 30 days |
| Post-sale (`SaleService` Task.Run) | **Always on**, no feature flag; `exportToDesktop: true` |

| Location | Durable on Render? |
|----------|-------------------|
| `{cwd}/backups/*.zip` | No (ephemeral) |
| Desktop / `/tmp/HexaBill_Backups` | Weak in cloud |
| Browser download | Yes |
| S3/R2 if configured | Yes |
| Google Drive | Not implemented |

---

## POS “auto-backup” label

- Searched `PosEnterprisePage`, `PosPageLegacy`, `PosPage` — **zero** backup/auto-backup UI strings
- Mechanism works on the **server** after each sale; no POS indicator needed unless product wants a status chip
- **B3 follow-up:** UI-only indicator only if desired; **no rebuild** of backup. Prefer enabling schedule + S3 for production durability over POS chrome

---

## Production notes

1. Ephemeral disk → download or S3 required  
2. Full ZIP every sale is expensive; desktop path weak in cloud  
3. Scheduled backup off by default  
