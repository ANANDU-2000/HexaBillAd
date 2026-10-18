# Live production database: full schema report (2026-10-18, before the pending migrations)

Source: the live Render PostgreSQL database `hexabill` (host `dpg-d68jhpk9c44c73ft047g-a.singapore-postgres.render.com`, user `hexabill_user`), read through a read-only session. No password or key appears in this file. Counts are from the verified full backup `production-before-20261018-live-full.dump` (restored to a scratch database; all 70 table counts matched). "Model" means a database built from the current source model (`EnsureCreated`), which includes migrations and tables that exist only in local commits.

## Summary

- Live tables: **70** (excluding the history table: 69); live columns: **909**; rows in all tables: **21,236**; migration history rows: **59** (last `20261018130000_BackfillCustomerOwnerId`).
- Tables owned by: hexabill_user. Invalid indexes: none.
- **MISSING live (in the model):** 4 tables, 3 columns.
- **EXTRA live (not in the model):** 0 tables, 5 columns. They hold data in places; do not drop blindly.
- **DIFFERENT** type or nullability: 27 columns.

## Missing in live (to be created by the pending migrations)

| Kind | Table | Column | Type | Nullable |
|---|---|---|---|---|
| table | `AiUsageDaily` | (6 columns) | | |
| table | `DriverLocationCurrents` | (12 columns) | | |
| table | `RouteRuns` | (14 columns) | | |
| table | `TenantDocumentChunks` | (8 columns) | | |
| column | `TenantDocumentVersions` | `ChunkCount` | integer | NO |
| column | `TenantDocumentVersions` | `SearchNote` | varchar(300) | YES |
| column | `TenantDocumentVersions` | `SearchStatus` | varchar(20) | NO |

## Extra in live (not in the model)

| Kind | Table | Column | Type | Nullable | Rows in table |
|---|---|---|---|---|---|
| column | `Branches` | `ManagerUserId` | integer | YES | 4 |
| column | `SupplierPayments` | `PurchaseId` | integer | YES | 28 |
| column | `SupplierPayments` | `SupplierId` | integer | YES | 28 |
| column | `Suppliers` | `OpeningBalance` | numeric(18,2) | NO | 19 |
| column | `Suppliers` | `SupplierCategoryId` | integer | YES | 19 |

## Different type or nullability (live vs model)

| Table | Column | Live | Model |
|---|---|---|---|
| `CreditNotes` | `AppliedAmount` | numeric(18,2) NOT NULL | numeric(,) NOT NULL |
| `CustomerVisits` | `Status` | varchar(50) NOT NULL | text NOT NULL |
| `ExpenseCategories` | `DefaultVatRate` | numeric(5,4) NOT NULL | numeric(,) NOT NULL |
| `Expenses` | `RejectionReason` | text NULL | varchar(500) NULL |
| `Expenses` | `TaxType` | text NULL | varchar(32) NULL |
| `HeldInvoices` | `RoundOff` | numeric(,) NOT NULL | numeric(18,2) NOT NULL |
| `PaymentReceipts` | `PdfStoragePath` | text NULL | varchar(500) NULL |
| `PaymentReceipts` | `ReceiptNumber` | text NOT NULL | varchar(30) NOT NULL |
| `ProductCategories` | `ColorCode` | varchar(20) NULL | varchar(7) NOT NULL |
| `ProductCategories` | `Description` | varchar(500) NULL | varchar(200) NULL |
| `ProductCategories` | `TenantId` | integer NOT NULL | integer NULL |
| `RecurringInvoiceItems` | `Qty` | numeric(,) NOT NULL | numeric(18,2) NOT NULL |
| `RecurringInvoiceItems` | `UnitPrice` | numeric(,) NOT NULL | numeric(18,2) NOT NULL |
| `RecurringInvoiceItems` | `UnitType` | text NOT NULL | varchar(20) NOT NULL |
| `SaleItems` | `VatScenario` | text NULL | varchar(20) NULL |
| `Sales` | `RoundOff` | numeric(,) NOT NULL | numeric(18,2) NOT NULL |
| `Sales` | `VatScenario` | text NULL | varchar(20) NULL |
| `SupplierPayments` | `Mode` | varchar(20) NULL | text NOT NULL |
| `SupplierPayments` | `SupplierName` | varchar(200) NULL | varchar(200) NOT NULL |
| `SupplierPayments` | `TenantId` | integer NULL | integer NOT NULL |
| `Suppliers` | `TenantId` | integer NULL | integer NOT NULL |
| `Tenants` | `Subdomain` | varchar(100) NOT NULL | varchar(30) NOT NULL |
| `VatReturnPeriods` | `PeriodLabel` | text NOT NULL | varchar(20) NOT NULL |
| `VatReturnPeriods` | `PeriodType` | text NOT NULL | varchar(10) NOT NULL |
| `VatReturnPeriods` | `ReviewInvalidatedReason` | text NULL | varchar(200) NULL |
| `VatReturnPeriods` | `SourceFingerprint` | text NULL | varchar(64) NULL |
| `VatReturnPeriods` | `Status` | text NOT NULL | varchar(15) NOT NULL |

## Migration history (live)

| # | MigrationId | ProductVersion |
|---|---|---|
| 1 | `20260214070330_InitialPostgreSQL` | 9.0.0 |
| 2 | `20260214173227_AddBranchAndRoute` | 9.0.0 |
| 3 | `20260215070856_AddBranchIdToExpense` | 9.0.0 |
| 4 | `20260215095609_AddMissingTables` | 9.0.0 |
| 5 | `20260215150153_EnterpriseBranchRoutePlan` | 9.0.0 |
| 6 | `20260215165632_FixBooleanColumnsType` | 9.0.0 |
| 7 | `20260215215659_AddUserSessionVersion` | 9.0.0 |
| 8 | `20260217111415_AddHeldInvoiceTable` | 9.0.0 |
| 9 | `20260217134457_AddProductsFeatures` | 9.0.0 |
| 10 | `20260218024142_AddExpenseRouteId` | 9.0.0 |
| 11 | `20260219062317_AddDamageCategoriesAndReturnExtensions` | 9.0.0 |
| 12 | `20260219100000_EnsureSettingsValueColumnPascalCase` | 9.0.0 |
| 13 | `20260219124000_AddFeaturesJsonToTenants` | 9.0.0 |
| 14 | `20260220100000_AddUserPageAccess` | 9.0.0 |
| 15 | `20260221100000_FixBranchStaffRouteStaffIdIdentity` | 9.0.0 |
| 16 | `20260221120000_AddReturnCategoryAndCondition` | 9.0.0 |
| 17 | `20260221120100_AddDamageInventory` | 9.0.0 |
| 18 | `20260221120200_AddCreditNotes` | 9.0.0 |
| 19 | `20260225120000_AddInvoiceTemplateTenantId` | 9.0.0 |
| 20 | `20260225130000_AddExpenseCategoryTenantId` | 9.0.0 |
| 21 | `20260305130821_AddSuppliersAndSupplierPayments` | 9.0.0 |
| 22 | `20260305131600_AddPurchasePaymentType` | 9.0.0 |
| 23 | `20260305162552_AddSupplierAndSupplierPayment` | 9.0.0 |
| 24 | `20260307135822_AddVendorDiscountsTable` | 10.0.3 |
| 25 | `20260310151454_AddVatReturnEngineFields` | 9.0.0 |
| 26 | `20260310165519_AddRoundOffToSalesAndHeldInvoices` | 9.0.0 |
| 27 | `20260310170435_AddPaymentReceiptsTable` | 9.0.0 |
| 28 | `20260310172228_AddExpenseCategoryVatDefaults` | 9.0.0 |
| 29 | `20260315060146_BackfillPurchaseIsTaxClaimable` | 9.0.0 |
| 30 | `20260719171633_AddQuotationsAndAgreements` | 9.0.0 |
| 31 | `20260719190000_AddQuotationLetterFields` | 9.0.0 |
| 32 | `20260728120000_AddSalaryCertificates` | 9.0.0 |
| 33 | `20260809180000_AddCustomerLocation` | 9.0.0 |
| 34 | `20260810120000_AddCustomerItemPrices` | 9.0.0 |
| 35 | `20260810210000_AddCustomerStopLocation` | 9.0.0 |
| 36 | `20260920030000_Run1IdentityFields` | 9.0.0 |
| 37 | `20260920033000_EnforceTenantSubdomains` | 9.0.0 |
| 38 | `20260920050000_SecureOnboardingAndSupport` | 9.0.0 |
| 39 | `20260927080000_AddTenantVatCalculationBasis` | 9.0.0 |
| 40 | `20260927190000_AddBackupAgentDevices` | 9.0.0 |
| 41 | `20261003090000_AddPaymentReceiptSnapshot` | 9.0.0 |
| 42 | `20261003110000_AddSaleItemCostBasis` | 9.0.0 |
| 43 | `20261003120000_AddPurchaseItemConversionAtPurchase` | 9.0.0 |
| 44 | `20261003130000_AddPurchaseItemCostCapturedAt` | 9.0.0 |
| 45 | `20261003140000_AddPaymentSettlementAdjustmentFlag` | 9.0.0 |
| 46 | `20261003150000_AddDailyCashClose` | 9.0.0 |
| 47 | `20261003160000_AddDailyCashCloseBankSnapshot` | 9.0.0 |
| 48 | `20261003170000_AddExpensePaidFrom` | 9.0.0 |
| 49 | `20261003180000_AddCashDrawerMovement` | 9.0.0 |
| 50 | `20261003190000_AddPaymentParentPaymentId` | 9.0.0 |
| 51 | `20261010090000_AddVatManagementSnapshot` | 9.0.0 |
| 52 | `20261010120000_AddVatCalculationVersioning` | 9.0.0 |
| 53 | `20261013090000_PreserveProductConversionPrecision` | 9.0.0 |
| 54 | `20261017100000_ScopeSaleReturnNumberToTenant` | 9.0.0 |
| 55 | `20261017110000_ScopePurchaseReturnNumberToTenant` | 9.0.0 |
| 56 | `20261017120000_DeclareProductBarcodeUniqueIndex` | 9.0.0 |
| 57 | `20261018090000_AddAssistantDrafts` | 9.0.0 |
| 58 | `20261018120000_AddTenantDocuments` | 9.0.0 |
| 59 | `20261018130000_BackfillCustomerOwnerId` | 9.0.0 |

## Every table: rows, owner, columns, keys and indexes (live)

### `Agreements`

Rows: **9** · owner: `hexabill_user` · columns: 19

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO | nextval('"Agreements_Id_seq"'::regclass) |
| 2 | `OwnerId` | integer | NO |  |
| 3 | `TenantId` | integer | yes |  |
| 4 | `AgreementNo` | varchar(50) | NO |  |
| 5 | `AgreementDate` | timestamp with time zone | NO |  |
| 6 | `SecondPartyName` | varchar(200) | yes |  |
| 7 | `SecondPartyLicense` | varchar(100) | yes |  |
| 8 | `SecondPartyAddress` | varchar(500) | yes |  |
| 9 | `SecondPartyMobile` | varchar(50) | yes |  |
| 10 | `TemplateVersion` | varchar(20) | NO |  |
| 11 | `Status` | varchar(20) | NO |  |
| 12 | `Notes` | text | yes |  |
| 13 | `CreatedBy` | integer | NO |  |
| 14 | `CreatedAt` | timestamp with time zone | NO |  |
| 15 | `LastModifiedBy` | integer | yes |  |
| 16 | `LastModifiedAt` | timestamp with time zone | yes |  |
| 17 | `IsDeleted` | boolean | NO | false |
| 18 | `DeletedBy` | integer | yes |  |
| 19 | `DeletedAt` | timestamp with time zone | yes |  |

Constraints:
- n: `NOT NULL "AgreementDate"`
- n: `NOT NULL "AgreementNo"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedBy"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "IsDeleted"`
- n: `NOT NULL "OwnerId"`
- n: `NOT NULL "Status"`
- n: `NOT NULL "TemplateVersion"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `Agreements_pkey`
- `IX_Agreements_TenantId`
- `IX_Agreements_TenantId_AgreementNo`

### `Alerts`

Rows: **320** · owner: `hexabill_user` · columns: 14

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `OwnerId` | integer | NO |  |
| 3 | `TenantId` | integer | yes |  |
| 4 | `Type` | varchar(100) | NO |  |
| 5 | `Title` | varchar(200) | NO |  |
| 6 | `Message` | varchar(2000) | yes |  |
| 7 | `Severity` | varchar(50) | NO |  |
| 8 | `IsRead` | boolean | NO |  |
| 9 | `IsResolved` | boolean | NO |  |
| 10 | `CreatedAt` | timestamp with time zone | NO |  |
| 11 | `ReadAt` | timestamp with time zone | yes |  |
| 12 | `ResolvedAt` | timestamp with time zone | yes |  |
| 13 | `ResolvedBy` | integer | yes |  |
| 14 | `Metadata` | varchar(500) | yes |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("ResolvedBy") REFERENCES "Users"("Id") ON DELETE SET NULL`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "IsRead"`
- n: `NOT NULL "IsResolved"`
- n: `NOT NULL "OwnerId"`
- n: `NOT NULL "Severity"`
- n: `NOT NULL "Title"`
- n: `NOT NULL "Type"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_Alerts_CreatedAt`
- `IX_Alerts_IsRead`
- `IX_Alerts_IsResolved`
- `IX_Alerts_ResolvedBy`
- `IX_Alerts_Type`
- `PK_Alerts`

### `AssistantDrafts`

Rows: **0** · owner: `hexabill_user` · columns: 12

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | uuid | NO |  |
| 2 | `TenantId` | integer | NO |  |
| 3 | `UserId` | integer | NO |  |
| 4 | `Kind` | varchar(40) | NO |  |
| 5 | `PayloadJson` | text | NO |  |
| 6 | `PayloadHash` | varchar(64) | NO |  |
| 7 | `Status` | varchar(20) | NO |  |
| 8 | `CreatedAt` | timestamp with time zone | NO |  |
| 9 | `ExpiresAt` | timestamp with time zone | NO |  |
| 10 | `ConfirmedAt` | timestamp with time zone | yes |  |
| 11 | `IdempotencyKey` | varchar(80) | yes |  |
| 12 | `ResultJson` | text | yes |  |

Constraints:
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "ExpiresAt"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "Kind"`
- n: `NOT NULL "PayloadHash"`
- n: `NOT NULL "PayloadJson"`
- n: `NOT NULL "Status"`
- n: `NOT NULL "TenantId"`
- n: `NOT NULL "UserId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_AssistantDrafts_TenantId_IdempotencyKey`
- `IX_AssistantDrafts_TenantId_UserId_Status`
- `PK_AssistantDrafts`

### `AuditLogs`

Rows: **1765** · owner: `hexabill_user` · columns: 12

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `OwnerId` | integer | NO |  |
| 3 | `TenantId` | integer | yes |  |
| 4 | `UserId` | integer | NO |  |
| 5 | `Action` | varchar(200) | NO |  |
| 6 | `EntityType` | varchar(100) | yes |  |
| 7 | `EntityId` | integer | yes |  |
| 8 | `OldValues` | text | yes |  |
| 9 | `NewValues` | text | yes |  |
| 10 | `IpAddress` | varchar(45) | yes |  |
| 11 | `Details` | text | yes |  |
| 12 | `CreatedAt` | timestamp with time zone | NO |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE`
- n: `NOT NULL "Action"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "OwnerId"`
- n: `NOT NULL "UserId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_AuditLogs_CreatedAt`
- `IX_AuditLogs_EntityType_EntityId`
- `IX_AuditLogs_TenantId`
- `IX_AuditLogs_UserId`
- `PK_AuditLogs`

### `BackupDeviceSchedules`

Rows: **0** · owner: `hexabill_user` · columns: 11

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `TenantId` | integer | NO |  |
| 3 | `DeviceId` | integer | NO |  |
| 4 | `Enabled` | boolean | NO |  |
| 5 | `Frequency` | varchar(16) | NO |  |
| 6 | `LocalTime` | varchar(5) | NO |  |
| 7 | `TimeZoneId` | varchar(80) | NO |  |
| 8 | `WeeklyDay` | integer | NO |  |
| 9 | `IncludeInvoicePdfs` | boolean | NO |  |
| 10 | `RetentionCount` | integer | NO |  |
| 11 | `UpdatedAt` | timestamp with time zone | NO |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("DeviceId") REFERENCES "BackupDevices"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE RESTRICT`
- n: `NOT NULL "DeviceId"`
- n: `NOT NULL "Enabled"`
- n: `NOT NULL "Frequency"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "IncludeInvoicePdfs"`
- n: `NOT NULL "LocalTime"`
- n: `NOT NULL "RetentionCount"`
- n: `NOT NULL "TenantId"`
- n: `NOT NULL "TimeZoneId"`
- n: `NOT NULL "UpdatedAt"`
- n: `NOT NULL "WeeklyDay"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_BackupDeviceSchedules_DeviceId`
- `IX_BackupDeviceSchedules_TenantId`
- `PK_BackupDeviceSchedules`

### `BackupDeviceTokens`

Rows: **0** · owner: `hexabill_user` · columns: 7

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `TenantId` | integer | NO |  |
| 3 | `DeviceId` | integer | NO |  |
| 4 | `TokenHash` | varchar(64) | NO |  |
| 5 | `ExpiresAt` | timestamp with time zone | NO |  |
| 6 | `RevokedAt` | timestamp with time zone | yes |  |
| 7 | `CreatedAt` | timestamp with time zone | NO |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("DeviceId") REFERENCES "BackupDevices"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE RESTRICT`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "DeviceId"`
- n: `NOT NULL "ExpiresAt"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "TenantId"`
- n: `NOT NULL "TokenHash"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_BackupDeviceTokens_DeviceId`
- `IX_BackupDeviceTokens_TokenHash`
- `PK_BackupDeviceTokens`

### `BackupDevices`

Rows: **0** · owner: `hexabill_user` · columns: 9

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `TenantId` | integer | NO |  |
| 3 | `CreatedByUserId` | integer | NO |  |
| 4 | `DisplayName` | varchar(80) | NO |  |
| 5 | `FolderLabel` | varchar(120) | yes |  |
| 6 | `LastSeenAt` | timestamp with time zone | yes |  |
| 7 | `RevokedAt` | timestamp with time zone | yes |  |
| 8 | `AgentVersion` | varchar(40) | yes |  |
| 9 | `CreatedAt` | timestamp with time zone | NO |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("CreatedByUserId") REFERENCES "Users"("Id") ON DELETE RESTRICT`
- FOREIGN KEY: `FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE RESTRICT`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedByUserId"`
- n: `NOT NULL "DisplayName"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "TenantId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_BackupDevices_CreatedByUserId`
- `IX_BackupDevices_TenantId`
- `PK_BackupDevices`

### `BackupPairingCodes`

Rows: **0** · owner: `hexabill_user` · columns: 7

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `TenantId` | integer | NO |  |
| 3 | `CreatedByUserId` | integer | NO |  |
| 4 | `CodeHash` | varchar(64) | NO |  |
| 5 | `ExpiresAt` | timestamp with time zone | NO |  |
| 6 | `ConsumedAt` | timestamp with time zone | yes |  |
| 7 | `CreatedAt` | timestamp with time zone | NO |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("CreatedByUserId") REFERENCES "Users"("Id") ON DELETE RESTRICT`
- FOREIGN KEY: `FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE RESTRICT`
- n: `NOT NULL "CodeHash"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedByUserId"`
- n: `NOT NULL "ExpiresAt"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "TenantId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_BackupPairingCodes_CodeHash`
- `IX_BackupPairingCodes_CreatedByUserId`
- `IX_BackupPairingCodes_TenantId`
- `PK_BackupPairingCodes`

### `BackupRuns`

Rows: **0** · owner: `hexabill_user` · columns: 14

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `TenantId` | integer | NO |  |
| 3 | `DeviceId` | integer | NO |  |
| 4 | `SlotKey` | varchar(16) | NO |  |
| 5 | `Status` | varchar(20) | NO |  |
| 6 | `SizeBytes` | bigint | yes |  |
| 7 | `Sha256` | varchar(64) | yes |  |
| 8 | `Verified` | boolean | NO |  |
| 9 | `MissedCatchUp` | boolean | NO |  |
| 10 | `FailureReason` | varchar(200) | yes |  |
| 11 | `FileName` | varchar(180) | yes |  |
| 12 | `DownloadName` | varchar(180) | yes |  |
| 13 | `StartedAt` | timestamp with time zone | NO |  |
| 14 | `CompletedAt` | timestamp with time zone | yes |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("DeviceId") REFERENCES "BackupDevices"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE RESTRICT`
- n: `NOT NULL "DeviceId"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "MissedCatchUp"`
- n: `NOT NULL "SlotKey"`
- n: `NOT NULL "StartedAt"`
- n: `NOT NULL "Status"`
- n: `NOT NULL "TenantId"`
- n: `NOT NULL "Verified"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_BackupRuns_DeviceId_SlotKey`
- `IX_BackupRuns_TenantId`
- `PK_BackupRuns`

### `BranchStaff`

Rows: **2** · owner: `hexabill_user` · columns: 4

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO | nextval('"BranchStaff_Id_seq"'::regclass) |
| 2 | `BranchId` | integer | NO |  |
| 3 | `UserId` | integer | NO |  |
| 4 | `AssignedAt` | timestamp with time zone | NO |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("BranchId") REFERENCES "Branches"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE`
- n: `NOT NULL "AssignedAt"`
- n: `NOT NULL "BranchId"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "UserId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_BranchStaff_BranchId`
- `IX_BranchStaff_BranchId_UserId`
- `IX_BranchStaff_UserId`
- `PK_BranchStaff`

### `Branches`

Rows: **4** · owner: `hexabill_user` · columns: 11

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `TenantId` | integer | NO |  |
| 3 | `Name` | varchar(200) | NO |  |
| 4 | `Address` | varchar(500) | yes |  |
| 5 | `CreatedAt` | timestamp with time zone | NO |  |
| 6 | `UpdatedAt` | timestamp with time zone | yes |  |
| 7 | `IsActive` | boolean | NO | true |
| 8 | `Location` | varchar(200) | yes |  |
| 9 | `ManagerUserId` | integer | yes |  |
| 10 | `ManagerId` | integer | yes |  |
| 11 | `ManagerId1` | integer | yes |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE CASCADE`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "IsActive"`
- n: `NOT NULL "Name"`
- n: `NOT NULL "TenantId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `Branches_pkey`
- `IX_Branches_TenantId`

### `CashDrawerMovements`

Rows: **0** · owner: `hexabill_user` · columns: 10

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `TenantId` | integer | NO |  |
| 3 | `OwnerId` | integer | NO |  |
| 4 | `BranchId` | integer | yes |  |
| 5 | `MovementDate` | timestamp with time zone | NO |  |
| 6 | `Kind` | integer | NO |  |
| 7 | `Amount` | numeric(18,2) | NO |  |
| 8 | `Note` | varchar(500) | yes |  |
| 9 | `CreatedByUserId` | integer | NO |  |
| 10 | `CreatedAt` | timestamp with time zone | NO |  |

Constraints:
- n: `NOT NULL "Amount"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedByUserId"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "Kind"`
- n: `NOT NULL "MovementDate"`
- n: `NOT NULL "OwnerId"`
- n: `NOT NULL "TenantId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `CashDrawerMovements_pkey`
- `IX_CashDrawerMovements_TenantId_MovementDate`

### `CreditNotes`

Rows: **0** · owner: `hexabill_user` · columns: 10

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO | nextval('"CreditNotes_Id_seq"'::regclass) |
| 2 | `TenantId` | integer | NO |  |
| 3 | `CustomerId` | integer | NO |  |
| 4 | `LinkedReturnId` | integer | NO |  |
| 5 | `Amount` | numeric(18,2) | NO |  |
| 6 | `Currency` | varchar(10) | NO |  |
| 7 | `Status` | varchar(20) | NO |  |
| 8 | `CreatedAt` | timestamp with time zone | NO |  |
| 9 | `CreatedBy` | integer | NO |  |
| 10 | `AppliedAmount` | numeric(18,2) | NO | 0 |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("CreatedBy") REFERENCES "Users"("Id")`
- FOREIGN KEY: `FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("LinkedReturnId") REFERENCES "SaleReturns"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE CASCADE`
- n: `NOT NULL "Amount"`
- n: `NOT NULL "AppliedAmount"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedBy"`
- n: `NOT NULL "Currency"`
- n: `NOT NULL "CustomerId"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "LinkedReturnId"`
- n: `NOT NULL "Status"`
- n: `NOT NULL "TenantId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `CreditNotes_pkey`
- `IX_CreditNotes_CustomerId`
- `IX_CreditNotes_LinkedReturnId`
- `IX_CreditNotes_TenantId`

### `CustomerItemPrices`

Rows: **861** · owner: `hexabill_user` · columns: 8

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `TenantId` | integer | NO |  |
| 3 | `CustomerId` | integer | NO |  |
| 4 | `ProductId` | integer | NO |  |
| 5 | `LastUnitPrice` | numeric(18,2) | NO |  |
| 6 | `LastSaleId` | integer | yes |  |
| 7 | `LastSaleDate` | timestamp with time zone | NO |  |
| 8 | `UpdatedAt` | timestamp with time zone | NO |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("LastSaleId") REFERENCES "Sales"("Id") ON DELETE SET NULL`
- FOREIGN KEY: `FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE RESTRICT`
- n: `NOT NULL "CustomerId"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "LastSaleDate"`
- n: `NOT NULL "LastUnitPrice"`
- n: `NOT NULL "ProductId"`
- n: `NOT NULL "TenantId"`
- n: `NOT NULL "UpdatedAt"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `CustomerItemPrices_pkey`
- `IX_CustomerItemPrices_CustomerId`
- `IX_CustomerItemPrices_LastSaleId`
- `IX_CustomerItemPrices_ProductId`
- `IX_CustomerItemPrices_TenantId_CustomerId_ProductId`

### `CustomerVisits`

Rows: **0** · owner: `hexabill_user` · columns: 14

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO | nextval('"CustomerVisits_Id_seq"'::regclass) |
| 2 | `RouteId` | integer | NO |  |
| 3 | `CustomerId` | integer | NO |  |
| 4 | `TenantId` | integer | NO |  |
| 5 | `StaffId` | integer | yes |  |
| 6 | `VisitDate` | timestamp with time zone | NO |  |
| 7 | `Status` | varchar(50) | NO | 'NotVisited'::character varying |
| 8 | `Notes` | varchar(500) | yes |  |
| 9 | `PaymentCollected` | numeric(18,2) | yes |  |
| 10 | `CreatedAt` | timestamp with time zone | NO | (now() AT TIME ZONE 'utc'::text) |
| 11 | `UpdatedAt` | timestamp with time zone | yes |  |
| 12 | `Latitude` | numeric(9,6) | yes |  |
| 13 | `Longitude` | numeric(9,6) | yes |  |
| 14 | `ReachedAt` | timestamp with time zone | yes |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("RouteId") REFERENCES "Routes"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("StaffId") REFERENCES "Users"("Id") ON DELETE SET NULL`
- FOREIGN KEY: `FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE CASCADE`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CustomerId"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "RouteId"`
- n: `NOT NULL "Status"`
- n: `NOT NULL "TenantId"`
- n: `NOT NULL "VisitDate"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `CustomerVisits_pkey`
- `IX_CustomerVisits_RouteId_CustomerId_VisitDate`
- `IX_CustomerVisits_TenantId`
- `IX_CustomerVisits_TenantId_CustomerId_VisitDate`
- `IX_CustomerVisits_VisitDate`

### `Customers`

Rows: **97** · owner: `hexabill_user` · columns: 27

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `OwnerId` | integer | NO |  |
| 3 | `TenantId` | integer | yes |  |
| 4 | `Name` | varchar(200) | NO |  |
| 5 | `CustomerType` | integer | NO |  |
| 6 | `Phone` | varchar(20) | yes |  |
| 7 | `Email` | varchar(100) | yes |  |
| 8 | `Trn` | varchar(50) | yes |  |
| 9 | `Address` | varchar(500) | yes |  |
| 10 | `CreditLimit` | numeric(18,2) | NO | 0.0 |
| 11 | `TotalSales` | numeric(18,2) | NO | 0.0 |
| 12 | `TotalPayments` | numeric(18,2) | NO | 0.0 |
| 13 | `PendingBalance` | numeric(18,2) | NO | 0.0 |
| 14 | `Balance` | numeric(18,2) | NO | 0.0 |
| 15 | `LastActivity` | timestamp with time zone | yes |  |
| 16 | `LastPaymentDate` | timestamp with time zone | yes |  |
| 17 | `CreatedAt` | timestamp with time zone | NO |  |
| 18 | `UpdatedAt` | timestamp with time zone | NO |  |
| 19 | `RowVersion` | bytea | yes | '\x00'::bytea |
| 20 | `PaymentTerms` | varchar(100) | yes |  |
| 21 | `BranchId` | integer | yes |  |
| 22 | `RouteId` | integer | yes |  |
| 23 | `Location` | varchar(200) | yes |  |
| 24 | `MainLatitude` | numeric(9,6) | yes |  |
| 25 | `MainLongitude` | numeric(9,6) | yes |  |
| 26 | `LocationUpdatedAt` | timestamp with time zone | yes |  |
| 27 | `LocationUpdatedBy` | integer | yes |  |

Constraints:
- n: `NOT NULL "Balance"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreditLimit"`
- n: `NOT NULL "CustomerType"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "Name"`
- n: `NOT NULL "OwnerId"`
- n: `NOT NULL "PendingBalance"`
- n: `NOT NULL "TotalPayments"`
- n: `NOT NULL "TotalSales"`
- n: `NOT NULL "UpdatedAt"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_Customers_TenantId_HasMainPin`
- `IX_Customers_TenantId_RouteId`
- `PK_Customers`
- `idx_customers_tenant_name`
- `idx_customers_tenantid`

### `DailyCashCloses`

Rows: **1** · owner: `hexabill_user` · columns: 24

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `TenantId` | integer | NO |  |
| 3 | `OwnerId` | integer | NO |  |
| 4 | `BranchId` | integer | yes |  |
| 5 | `BusinessDate` | timestamp with time zone | NO |  |
| 6 | `Version` | integer | NO |  |
| 7 | `Status` | text | NO |  |
| 8 | `OpeningCash` | numeric(18,2) | NO |  |
| 9 | `CashReceived` | numeric(18,2) | NO |  |
| 10 | `CashPaidOut` | numeric(18,2) | NO |  |
| 11 | `ExpectedCash` | numeric(18,2) | NO |  |
| 12 | `CountedCash` | numeric(18,2) | NO |  |
| 13 | `Variance` | numeric(18,2) | NO |  |
| 14 | `VarianceReason` | varchar(500) | yes |  |
| 15 | `Comment` | varchar(1000) | yes |  |
| 16 | `ClosedAt` | timestamp with time zone | yes |  |
| 17 | `ClosedByUserId` | integer | yes |  |
| 18 | `ReopenedAt` | timestamp with time zone | yes |  |
| 19 | `ReopenReason` | varchar(500) | yes |  |
| 20 | `CreatedByUserId` | integer | NO |  |
| 21 | `CreatedAt` | timestamp with time zone | NO |  |
| 22 | `UpdatedAt` | timestamp with time zone | NO |  |
| 23 | `BankPaidOut` | numeric(18,2) | NO | 0 |
| 24 | `BankReceived` | numeric(18,2) | NO | 0 |

Constraints:
- n: `NOT NULL "BankPaidOut"`
- n: `NOT NULL "BankReceived"`
- n: `NOT NULL "BusinessDate"`
- n: `NOT NULL "CashPaidOut"`
- n: `NOT NULL "CashReceived"`
- n: `NOT NULL "CountedCash"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedByUserId"`
- n: `NOT NULL "ExpectedCash"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "OpeningCash"`
- n: `NOT NULL "OwnerId"`
- n: `NOT NULL "Status"`
- n: `NOT NULL "TenantId"`
- n: `NOT NULL "UpdatedAt"`
- n: `NOT NULL "Variance"`
- n: `NOT NULL "Version"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `DailyCashCloses_pkey`
- `IX_DailyCashCloses_TenantId_BusinessDate_BranchId_Version`

### `DamageCategories`

Rows: **10** · owner: `hexabill_user` · columns: 8

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO | nextval('"DamageCategories_Id_seq"'::regclass) |
| 2 | `TenantId` | integer | NO |  |
| 3 | `Name` | varchar(100) | NO |  |
| 4 | `AffectsStock` | boolean | NO | true |
| 5 | `AffectsLedger` | boolean | NO | true |
| 6 | `IsResaleable` | boolean | NO | true |
| 7 | `SortOrder` | integer | NO | 0 |
| 8 | `CreatedAt` | timestamp with time zone | NO |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE CASCADE`
- n: `NOT NULL "AffectsLedger"`
- n: `NOT NULL "AffectsStock"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "IsResaleable"`
- n: `NOT NULL "Name"`
- n: `NOT NULL "SortOrder"`
- n: `NOT NULL "TenantId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `DamageCategories_pkey`
- `IX_DamageCategories_TenantId`

### `DamageInventories`

Rows: **0** · owner: `hexabill_user` · columns: 8

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO | nextval('"DamageInventories_Id_seq"'::regclass) |
| 2 | `TenantId` | integer | NO |  |
| 3 | `ProductId` | integer | NO |  |
| 4 | `BranchId` | integer | yes |  |
| 5 | `Quantity` | numeric(18,2) | NO | 0 |
| 6 | `SourceReturnId` | integer | yes |  |
| 7 | `CreatedAt` | timestamp with time zone | NO |  |
| 8 | `UpdatedAt` | timestamp with time zone | NO |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("BranchId") REFERENCES "Branches"("Id")`
- FOREIGN KEY: `FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("SourceReturnId") REFERENCES "SaleReturns"("Id")`
- FOREIGN KEY: `FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE CASCADE`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "ProductId"`
- n: `NOT NULL "Quantity"`
- n: `NOT NULL "TenantId"`
- n: `NOT NULL "UpdatedAt"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `DamageInventories_pkey`
- `IX_DamageInventories_TenantId_ProductId_BranchId`

### `DemoRequests`

Rows: **0** · owner: `hexabill_user` · columns: 16

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `CompanyName` | varchar(200) | NO |  |
| 3 | `ContactName` | varchar(100) | NO |  |
| 4 | `WhatsApp` | varchar(20) | NO |  |
| 5 | `Email` | varchar(100) | NO |  |
| 6 | `Country` | varchar(10) | NO |  |
| 7 | `Industry` | varchar(100) | NO |  |
| 8 | `MonthlySalesRange` | varchar(50) | NO |  |
| 9 | `StaffCount` | integer | NO |  |
| 10 | `Status` | text | NO |  |
| 11 | `RejectionReason` | varchar(500) | yes |  |
| 12 | `AssignedPlanId` | integer | yes |  |
| 13 | `CreatedTenantId` | integer | yes |  |
| 14 | `CreatedAt` | timestamp with time zone | NO |  |
| 15 | `ProcessedAt` | timestamp with time zone | yes |  |
| 16 | `ProcessedByUserId` | integer | yes |  |

Constraints:
- n: `NOT NULL "CompanyName"`
- n: `NOT NULL "ContactName"`
- n: `NOT NULL "Country"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "Email"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "Industry"`
- n: `NOT NULL "MonthlySalesRange"`
- n: `NOT NULL "StaffCount"`
- n: `NOT NULL "Status"`
- n: `NOT NULL "WhatsApp"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_DemoRequests_CreatedAt`
- `IX_DemoRequests_Email`
- `IX_DemoRequests_Status`
- `PK_DemoRequests`

### `ErrorLogs`

Rows: **89** · owner: `hexabill_user` · columns: 11

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `TraceId` | varchar(64) | NO |  |
| 3 | `ErrorCode` | varchar(64) | NO |  |
| 4 | `Message` | varchar(2000) | NO |  |
| 5 | `StackTrace` | text | yes |  |
| 6 | `Path` | varchar(500) | yes |  |
| 7 | `Method` | varchar(16) | yes |  |
| 8 | `TenantId` | integer | yes |  |
| 9 | `UserId` | integer | yes |  |
| 10 | `CreatedAt` | timestamp with time zone | NO |  |
| 11 | `ResolvedAt` | timestamp with time zone | yes |  |

Constraints:
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "ErrorCode"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "Message"`
- n: `NOT NULL "TraceId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_ErrorLogs_CreatedAt`
- `IX_ErrorLogs_ErrorCode`
- `IX_ErrorLogs_ResolvedAt`
- `IX_ErrorLogs_TenantId`
- `PK_ErrorLogs`

### `ExpenseCategories`

Rows: **85** · owner: `hexabill_user` · columns: 11

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `Name` | varchar(100) | NO |  |
| 3 | `ColorCode` | varchar(7) | NO |  |
| 4 | `IsActive` | boolean | NO |  |
| 5 | `CreatedAt` | timestamp with time zone | NO |  |
| 6 | `TenantId` | integer | yes |  |
| 7 | `DefaultVatRate` | numeric(5,4) | NO | 0.0 |
| 8 | `DefaultTaxType` | varchar(20) | NO | 'Standard'::character varying |
| 9 | `DefaultIsTaxClaimable` | boolean | NO | false |
| 10 | `DefaultIsEntertainment` | boolean | NO | false |
| 11 | `VatDefaultLocked` | boolean | NO | false |

Constraints:
- n: `NOT NULL "ColorCode"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "DefaultIsEntertainment"`
- n: `NOT NULL "DefaultIsTaxClaimable"`
- n: `NOT NULL "DefaultTaxType"`
- n: `NOT NULL "DefaultVatRate"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "IsActive"`
- n: `NOT NULL "Name"`
- n: `NOT NULL "VatDefaultLocked"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_ExpenseCategories_TenantId_Name`
- `PK_ExpenseCategories`

### `Expenses`

Rows: **70** · owner: `hexabill_user` · columns: 27

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `OwnerId` | integer | NO |  |
| 3 | `TenantId` | integer | yes |  |
| 4 | `CategoryId` | integer | NO |  |
| 5 | `Amount` | numeric(18,2) | NO |  |
| 6 | `Date` | timestamp with time zone | NO |  |
| 7 | `Note` | varchar(500) | yes |  |
| 8 | `CreatedBy` | integer | NO |  |
| 9 | `CreatedAt` | timestamp with time zone | NO |  |
| 10 | `BranchId` | integer | yes |  |
| 11 | `AttachmentUrl` | varchar(500) | yes |  |
| 12 | `Status` | integer | NO | 1 |
| 13 | `RecurringExpenseId` | integer | yes |  |
| 14 | `ApprovedBy` | integer | yes |  |
| 15 | `ApprovedAt` | timestamp with time zone | yes |  |
| 16 | `RejectionReason` | text | yes |  |
| 17 | `RouteId` | integer | yes |  |
| 18 | `ClaimableVat` | numeric(18,4) | yes |  |
| 19 | `IsEntertainment` | integer | NO | 0 |
| 20 | `IsTaxClaimable` | integer | NO | 0 |
| 21 | `PartialCreditPct` | numeric(18,4) | NO | 0.0 |
| 22 | `TaxType` | text | yes |  |
| 23 | `TotalAmount` | numeric(18,4) | yes |  |
| 24 | `VatAmount` | numeric(18,4) | yes |  |
| 25 | `VatRate` | numeric(18,4) | yes |  |
| 26 | `VatInclusive` | boolean | yes |  |
| 27 | `PaidFrom` | integer | NO | 0 |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("BranchId") REFERENCES "Branches"("Id")`
- FOREIGN KEY: `FOREIGN KEY ("CategoryId") REFERENCES "ExpenseCategories"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("CreatedBy") REFERENCES "Users"("Id") ON DELETE CASCADE`
- n: `NOT NULL "Amount"`
- n: `NOT NULL "CategoryId"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedBy"`
- n: `NOT NULL "Date"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "IsEntertainment"`
- n: `NOT NULL "IsTaxClaimable"`
- n: `NOT NULL "OwnerId"`
- n: `NOT NULL "PaidFrom"`
- n: `NOT NULL "PartialCreditPct"`
- n: `NOT NULL "Status"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_Expenses_BranchId`
- `IX_Expenses_CategoryId`
- `IX_Expenses_CreatedBy`
- `IX_Expenses_TenantId`
- `IX_Expenses_TenantId_BranchId`
- `IX_Expenses_TenantId_CategoryId`
- `IX_Expenses_TenantId_RouteId`
- `PK_Expenses`
- `idx_expenses_createdat`
- `idx_expenses_tenantid`

### `FailedLoginAttempts`

Rows: **0** · owner: `hexabill_user` · columns: 7

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO | nextval('"FailedLoginAttempts_Id_seq"'::regclass) |
| 2 | `Email` | varchar(100) | NO |  |
| 3 | `FailedCount` | integer | NO | 1 |
| 4 | `LockoutUntil` | timestamp with time zone | yes |  |
| 5 | `LastAttemptAt` | timestamp with time zone | NO |  |
| 6 | `CreatedAt` | timestamp with time zone | NO |  |
| 7 | `UpdatedAt` | timestamp with time zone | yes |  |

Constraints:
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "Email"`
- n: `NOT NULL "FailedCount"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "LastAttemptAt"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `FailedLoginAttempts_pkey`
- `IX_FailedLoginAttempts_Email`
- `IX_FailedLoginAttempts_LastAttemptAt`
- `IX_FailedLoginAttempts_LockoutUntil`

### `HeldInvoices`

Rows: **0** · owner: `hexabill_user` · columns: 7

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO | nextval('"HeldInvoices_Id_seq"'::regclass) |
| 2 | `TenantId` | integer | NO |  |
| 3 | `UserId` | integer | NO |  |
| 4 | `Name` | varchar(200) | NO |  |
| 5 | `InvoiceData` | text | NO |  |
| 6 | `CreatedAt` | timestamp with time zone | NO |  |
| 7 | `RoundOff` | numeric(,) | NO | 0 |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "InvoiceData"`
- n: `NOT NULL "Name"`
- n: `NOT NULL "RoundOff"`
- n: `NOT NULL "TenantId"`
- n: `NOT NULL "UserId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `HeldInvoices_pkey`
- `IX_HeldInvoices_UserId`

### `InventoryTransactions`

Rows: **7498** · owner: `hexabill_user` · columns: 9

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `OwnerId` | integer | NO |  |
| 3 | `TenantId` | integer | yes |  |
| 4 | `ProductId` | integer | NO |  |
| 5 | `ChangeQty` | numeric(18,2) | NO |  |
| 6 | `TransactionType` | text | NO |  |
| 7 | `RefId` | integer | yes |  |
| 8 | `Reason` | text | yes |  |
| 9 | `CreatedAt` | timestamp with time zone | NO |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE`
- n: `NOT NULL "ChangeQty"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "OwnerId"`
- n: `NOT NULL "ProductId"`
- n: `NOT NULL "TransactionType"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_InventoryTransactions_ProductId`
- `IX_InventoryTransactions_TenantId_TransactionType_CreatedAt`
- `PK_InventoryTransactions`

### `InvoiceTemplates`

Rows: **0** · owner: `hexabill_user` · columns: 11

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `Name` | varchar(200) | NO |  |
| 3 | `Version` | varchar(50) | NO |  |
| 4 | `CreatedBy` | integer | NO |  |
| 5 | `CreatedAt` | timestamp with time zone | NO |  |
| 6 | `UpdatedAt` | timestamp with time zone | yes |  |
| 7 | `HtmlCode` | text | NO |  |
| 8 | `CssCode` | text | yes |  |
| 9 | `IsActive` | boolean | NO |  |
| 10 | `Description` | varchar(1000) | yes |  |
| 11 | `TenantId` | integer | yes |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("CreatedBy") REFERENCES "Users"("Id") ON DELETE CASCADE`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedBy"`
- n: `NOT NULL "HtmlCode"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "IsActive"`
- n: `NOT NULL "Name"`
- n: `NOT NULL "Version"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_InvoiceTemplates_CreatedBy`
- `IX_InvoiceTemplates_IsActive`
- `IX_InvoiceTemplates_TenantId`
- `PK_InvoiceTemplates`

### `InvoiceVersions`

Rows: **82** · owner: `hexabill_user` · columns: 10

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `OwnerId` | integer | NO |  |
| 3 | `TenantId` | integer | yes |  |
| 4 | `SaleId` | integer | NO |  |
| 5 | `VersionNumber` | integer | NO |  |
| 6 | `CreatedById` | integer | NO |  |
| 7 | `CreatedAt` | timestamp with time zone | NO |  |
| 8 | `DataJson` | jsonb | NO |  |
| 9 | `EditReason` | varchar(500) | yes |  |
| 10 | `DiffSummary` | varchar(1000) | yes |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("CreatedById") REFERENCES "Users"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("SaleId") REFERENCES "Sales"("Id") ON DELETE CASCADE`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedById"`
- n: `NOT NULL "DataJson"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "OwnerId"`
- n: `NOT NULL "SaleId"`
- n: `NOT NULL "VersionNumber"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_InvoiceVersions_CreatedById`
- `IX_InvoiceVersions_SaleId`
- `IX_InvoiceVersions_SaleId_VersionNumber`
- `PK_InvoiceVersions`

### `PaymentIdempotencies`

Rows: **386** · owner: `hexabill_user` · columns: 5

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `IdempotencyKey` | varchar(100) | NO |  |
| 2 | `PaymentId` | integer | NO |  |
| 3 | `UserId` | integer | NO |  |
| 4 | `CreatedAt` | timestamp with time zone | NO |  |
| 5 | `ResponseSnapshot` | jsonb | yes |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("PaymentId") REFERENCES "Payments"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "IdempotencyKey"`
- n: `NOT NULL "PaymentId"`
- n: `NOT NULL "UserId"`
- PRIMARY KEY: `PRIMARY KEY ("IdempotencyKey")`

Indexes:
- `IX_PaymentIdempotencies_IdempotencyKey`
- `IX_PaymentIdempotencies_PaymentId`
- `IX_PaymentIdempotencies_UserId`
- `PK_PaymentIdempotencies`

### `PaymentReceipts`

Rows: **6** · owner: `hexabill_user` · columns: 8

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `TenantId` | integer | NO |  |
| 3 | `ReceiptNumber` | text | NO |  |
| 4 | `PaymentId` | integer | NO |  |
| 5 | `GeneratedAt` | timestamp with time zone | NO |  |
| 6 | `GeneratedByUserId` | integer | NO |  |
| 7 | `PdfStoragePath` | text | yes |  |
| 8 | `SnapshotJson` | text | yes |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("GeneratedByUserId") REFERENCES "Users"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("PaymentId") REFERENCES "Payments"("Id") ON DELETE CASCADE`
- n: `NOT NULL "GeneratedAt"`
- n: `NOT NULL "GeneratedByUserId"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "PaymentId"`
- n: `NOT NULL "ReceiptNumber"`
- n: `NOT NULL "TenantId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_PaymentReceipts_GeneratedByUserId`
- `IX_PaymentReceipts_PaymentId`
- `IX_PaymentReceipts_TenantId_PaymentId`
- `IX_PaymentReceipts_TenantId_ReceiptNumber`
- `PK_PaymentReceipts`

### `Payments`

Rows: **976** · owner: `hexabill_user` · columns: 17

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `OwnerId` | integer | NO |  |
| 3 | `TenantId` | integer | yes |  |
| 4 | `SaleId` | integer | yes |  |
| 5 | `CustomerId` | integer | yes |  |
| 6 | `Amount` | numeric(18,2) | NO |  |
| 7 | `Mode` | text | NO |  |
| 8 | `Reference` | varchar(200) | yes |  |
| 9 | `Status` | text | NO |  |
| 10 | `PaymentDate` | timestamp with time zone | NO |  |
| 11 | `CreatedBy` | integer | NO |  |
| 12 | `CreatedAt` | timestamp with time zone | NO |  |
| 13 | `UpdatedAt` | timestamp with time zone | yes |  |
| 14 | `RowVersion` | bytea | yes |  |
| 15 | `SaleReturnId` | integer | yes |  |
| 16 | `IsSettlementAdjustment` | boolean | NO | false |
| 17 | `ParentPaymentId` | integer | yes |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("CreatedBy") REFERENCES "Users"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id")`
- FOREIGN KEY: `FOREIGN KEY ("SaleId") REFERENCES "Sales"("Id")`
- n: `NOT NULL "Amount"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedBy"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "IsSettlementAdjustment"`
- n: `NOT NULL "Mode"`
- n: `NOT NULL "OwnerId"`
- n: `NOT NULL "PaymentDate"`
- n: `NOT NULL "Status"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_Payments_CreatedBy`
- `IX_Payments_CustomerId`
- `IX_Payments_ParentPaymentId`
- `IX_Payments_SaleId`
- `IX_Payments_TenantId_SaleId`
- `IX_Payments_TenantId_Status`
- `PK_Payments`
- `idx_payments_createdat`
- `idx_payments_customer`
- `idx_payments_tenant_created`
- `idx_payments_tenantid`

### `PriceChangeLogs`

Rows: **17** · owner: `hexabill_user` · columns: 10

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `OwnerId` | integer | NO |  |
| 3 | `TenantId` | integer | yes |  |
| 4 | `ProductId` | integer | NO |  |
| 5 | `OldPrice` | numeric(18,2) | NO |  |
| 6 | `NewPrice` | numeric(18,2) | NO |  |
| 7 | `PriceDifference` | numeric(18,2) | NO |  |
| 8 | `ChangedBy` | integer | NO |  |
| 9 | `Reason` | varchar(500) | yes |  |
| 10 | `ChangedAt` | timestamp with time zone | NO |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("ChangedBy") REFERENCES "Users"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE`
- n: `NOT NULL "ChangedAt"`
- n: `NOT NULL "ChangedBy"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "NewPrice"`
- n: `NOT NULL "OldPrice"`
- n: `NOT NULL "OwnerId"`
- n: `NOT NULL "PriceDifference"`
- n: `NOT NULL "ProductId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_PriceChangeLogs_ChangedBy`
- `IX_PriceChangeLogs_ProductId`
- `PK_PriceChangeLogs`

### `ProductCategories`

Rows: **4** · owner: `hexabill_user` · columns: 8

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO | nextval('"ProductCategories_Id_seq"'::regclass) |
| 2 | `TenantId` | integer | NO |  |
| 3 | `Name` | varchar(100) | NO |  |
| 4 | `Description` | varchar(500) | yes |  |
| 5 | `ColorCode` | varchar(20) | yes |  |
| 6 | `IsActive` | boolean | NO | true |
| 7 | `CreatedAt` | timestamp with time zone | NO |  |
| 8 | `UpdatedAt` | timestamp with time zone | NO |  |

Constraints:
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "IsActive"`
- n: `NOT NULL "Name"`
- n: `NOT NULL "TenantId"`
- n: `NOT NULL "UpdatedAt"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_ProductCategories_TenantId_Name`
- `ProductCategories_pkey`

### `Products`

Rows: **124** · owner: `hexabill_user` · columns: 22

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `OwnerId` | integer | NO |  |
| 3 | `TenantId` | integer | yes |  |
| 4 | `Sku` | varchar(50) | NO |  |
| 5 | `NameEn` | varchar(200) | NO |  |
| 6 | `NameAr` | varchar(200) | yes |  |
| 7 | `UnitType` | varchar(20) | NO |  |
| 8 | `ConversionToBase` | numeric(18,4) | NO |  |
| 9 | `CostPrice` | numeric(18,2) | NO |  |
| 10 | `SellPrice` | numeric(18,2) | NO |  |
| 11 | `StockQty` | numeric(18,2) | NO |  |
| 12 | `ReorderLevel` | integer | NO |  |
| 13 | `ExpiryDate` | timestamp with time zone | yes |  |
| 14 | `DescriptionEn` | text | yes |  |
| 15 | `DescriptionAr` | text | yes |  |
| 16 | `RowVersion` | bytea | NO | '\x00'::bytea |
| 17 | `CreatedAt` | timestamp with time zone | NO |  |
| 18 | `UpdatedAt` | timestamp with time zone | NO |  |
| 19 | `Barcode` | varchar(100) | yes |  |
| 20 | `ImageUrl` | varchar(500) | yes |  |
| 21 | `CategoryId` | integer | yes |  |
| 22 | `IsActive` | boolean | NO | true |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("CategoryId") REFERENCES "ProductCategories"("Id") ON DELETE SET NULL`
- n: `NOT NULL "ConversionToBase"`
- n: `NOT NULL "CostPrice"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "IsActive"`
- n: `NOT NULL "NameEn"`
- n: `NOT NULL "OwnerId"`
- n: `NOT NULL "ReorderLevel"`
- n: `NOT NULL "RowVersion"`
- n: `NOT NULL "SellPrice"`
- n: `NOT NULL "Sku"`
- n: `NOT NULL "StockQty"`
- n: `NOT NULL "UnitType"`
- n: `NOT NULL "UpdatedAt"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_Products_Barcode`
- `IX_Products_CategoryId`
- `IX_Products_ImageUrl`
- `IX_Products_IsActive`
- `IX_Products_TenantId_Barcode`
- `IX_Products_TenantId_Sku`
- `PK_Products`
- `idx_products_tenant_name`
- `idx_products_tenant_sku`
- `idx_products_tenantid`

### `PurchaseItems`

Rows: **327** · owner: `hexabill_user` · columns: 11

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `PurchaseId` | integer | NO |  |
| 3 | `ProductId` | integer | NO |  |
| 4 | `UnitType` | varchar(20) | NO |  |
| 5 | `Qty` | numeric(18,2) | NO |  |
| 6 | `UnitCost` | numeric(18,2) | NO |  |
| 7 | `UnitCostExclVat` | numeric(18,2) | yes |  |
| 8 | `VatAmount` | numeric(18,2) | yes |  |
| 9 | `LineTotal` | numeric(18,2) | NO |  |
| 10 | `ConversionAtPurchase` | numeric(18,6) | yes |  |
| 11 | `CostCapturedAt` | timestamp with time zone | yes |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("PurchaseId") REFERENCES "Purchases"("Id") ON DELETE CASCADE`
- n: `NOT NULL "Id"`
- n: `NOT NULL "LineTotal"`
- n: `NOT NULL "ProductId"`
- n: `NOT NULL "PurchaseId"`
- n: `NOT NULL "Qty"`
- n: `NOT NULL "UnitCost"`
- n: `NOT NULL "UnitType"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_PurchaseItems_ProductId`
- `IX_PurchaseItems_PurchaseId`
- `PK_PurchaseItems`

### `PurchaseReturnItems`

Rows: **0** · owner: `hexabill_user` · columns: 9

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `PurchaseReturnId` | integer | NO |  |
| 3 | `PurchaseItemId` | integer | NO |  |
| 4 | `ProductId` | integer | NO |  |
| 5 | `UnitType` | varchar(20) | NO |  |
| 6 | `Qty` | numeric(18,2) | NO |  |
| 7 | `UnitCost` | numeric(18,2) | NO |  |
| 8 | `LineTotal` | numeric(18,2) | NO |  |
| 9 | `Reason` | varchar(200) | yes |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("PurchaseItemId") REFERENCES "PurchaseItems"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("PurchaseReturnId") REFERENCES "PurchaseReturns"("Id") ON DELETE CASCADE`
- n: `NOT NULL "Id"`
- n: `NOT NULL "LineTotal"`
- n: `NOT NULL "ProductId"`
- n: `NOT NULL "PurchaseItemId"`
- n: `NOT NULL "PurchaseReturnId"`
- n: `NOT NULL "Qty"`
- n: `NOT NULL "UnitCost"`
- n: `NOT NULL "UnitType"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_PurchaseReturnItems_ProductId`
- `IX_PurchaseReturnItems_PurchaseItemId`
- `IX_PurchaseReturnItems_PurchaseReturnId`
- `PK_PurchaseReturnItems`

### `PurchaseReturns`

Rows: **0** · owner: `hexabill_user` · columns: 14

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `OwnerId` | integer | NO |  |
| 3 | `TenantId` | integer | yes |  |
| 4 | `PurchaseId` | integer | NO |  |
| 5 | `SupplierId` | integer | yes |  |
| 6 | `ReturnNo` | varchar(100) | NO |  |
| 7 | `ReturnDate` | timestamp with time zone | NO |  |
| 8 | `Subtotal` | numeric(18,2) | NO |  |
| 9 | `VatTotal` | numeric(18,2) | NO |  |
| 10 | `GrandTotal` | numeric(18,2) | NO |  |
| 11 | `Reason` | varchar(500) | yes |  |
| 12 | `Status` | text | NO |  |
| 13 | `CreatedBy` | integer | NO |  |
| 14 | `CreatedAt` | timestamp with time zone | NO |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("CreatedBy") REFERENCES "Users"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("PurchaseId") REFERENCES "Purchases"("Id") ON DELETE CASCADE`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedBy"`
- n: `NOT NULL "GrandTotal"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "OwnerId"`
- n: `NOT NULL "PurchaseId"`
- n: `NOT NULL "ReturnDate"`
- n: `NOT NULL "ReturnNo"`
- n: `NOT NULL "Status"`
- n: `NOT NULL "Subtotal"`
- n: `NOT NULL "VatTotal"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_PurchaseReturns_CreatedBy`
- `IX_PurchaseReturns_PurchaseId`
- `IX_PurchaseReturns_TenantId_ReturnNo`
- `PK_PurchaseReturns`

### `Purchases`

Rows: **30** · owner: `hexabill_user` · columns: 22

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `OwnerId` | integer | NO |  |
| 3 | `TenantId` | integer | yes |  |
| 4 | `SupplierName` | varchar(200) | NO |  |
| 5 | `InvoiceNo` | varchar(100) | NO |  |
| 6 | `ExternalReference` | varchar(200) | yes |  |
| 7 | `ExpenseCategory` | varchar(100) | yes |  |
| 8 | `PurchaseDate` | timestamp with time zone | NO |  |
| 9 | `Subtotal` | numeric(18,2) | yes |  |
| 10 | `VatTotal` | numeric(18,2) | yes |  |
| 11 | `TotalAmount` | numeric(18,2) | NO |  |
| 12 | `InvoiceFilePath` | varchar(500) | yes |  |
| 13 | `InvoiceFileName` | varchar(255) | yes |  |
| 14 | `CreatedBy` | integer | NO |  |
| 15 | `CreatedAt` | timestamp with time zone | NO |  |
| 16 | `AmountPaid` | numeric(18,2) | yes |  |
| 17 | `PaymentType` | varchar(20) | yes |  |
| 18 | `SupplierId` | integer | yes |  |
| 19 | `DueDate` | timestamp with time zone | yes |  |
| 20 | `IsReverseCharge` | integer | NO | 0 |
| 21 | `IsTaxClaimable` | integer | NO | 0 |
| 22 | `ReverseChargeVat` | numeric(18,4) | yes |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("CreatedBy") REFERENCES "Users"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("SupplierId") REFERENCES "Suppliers"("Id") ON DELETE SET NULL`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedBy"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "InvoiceNo"`
- n: `NOT NULL "IsReverseCharge"`
- n: `NOT NULL "IsTaxClaimable"`
- n: `NOT NULL "OwnerId"`
- n: `NOT NULL "PurchaseDate"`
- n: `NOT NULL "SupplierName"`
- n: `NOT NULL "TotalAmount"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_Purchases_CreatedBy`
- `IX_Purchases_OwnerId_InvoiceNo`
- `IX_Purchases_SupplierId`
- `IX_Purchases_TenantId_SupplierName`
- `PK_Purchases`
- `idx_purchases_createdat`
- `idx_purchases_tenantid`

### `QuotationItems`

Rows: **3** · owner: `hexabill_user` · columns: 12

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO | nextval('"QuotationItems_Id_seq"'::regclass) |
| 2 | `QuotationId` | integer | NO |  |
| 3 | `ProductId` | integer | yes |  |
| 4 | `Description` | varchar(500) | NO |  |
| 5 | `DescriptionSubtitle` | varchar(500) | yes |  |
| 6 | `UnitLabel` | varchar(50) | NO |  |
| 7 | `Qty` | numeric(18,4) | NO |  |
| 8 | `UnitPrice` | numeric(18,4) | NO |  |
| 9 | `VatRate` | numeric(18,4) | NO |  |
| 10 | `VatAmount` | numeric(18,2) | NO |  |
| 11 | `LineTotal` | numeric(18,2) | NO |  |
| 12 | `SortOrder` | integer | NO |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE SET NULL`
- FOREIGN KEY: `FOREIGN KEY ("QuotationId") REFERENCES "Quotations"("Id") ON DELETE CASCADE`
- n: `NOT NULL "Description"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "LineTotal"`
- n: `NOT NULL "Qty"`
- n: `NOT NULL "QuotationId"`
- n: `NOT NULL "SortOrder"`
- n: `NOT NULL "UnitLabel"`
- n: `NOT NULL "UnitPrice"`
- n: `NOT NULL "VatAmount"`
- n: `NOT NULL "VatRate"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_QuotationItems_ProductId`
- `IX_QuotationItems_QuotationId`
- `QuotationItems_pkey`

### `Quotations`

Rows: **3** · owner: `hexabill_user` · columns: 26

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO | nextval('"Quotations_Id_seq"'::regclass) |
| 2 | `OwnerId` | integer | NO |  |
| 3 | `TenantId` | integer | yes |  |
| 4 | `QuoteNo` | varchar(50) | NO |  |
| 5 | `QuoteDate` | timestamp with time zone | NO |  |
| 6 | `CustomerName` | varchar(200) | yes |  |
| 7 | `CustomerAddress` | varchar(500) | yes |  |
| 8 | `CustomerPhone` | varchar(50) | yes |  |
| 9 | `CustomerEmail` | varchar(100) | yes |  |
| 10 | `CustomerId` | integer | yes |  |
| 11 | `Subtotal` | numeric(18,2) | NO |  |
| 12 | `VatTotal` | numeric(18,2) | NO |  |
| 13 | `Discount` | numeric(18,2) | NO |  |
| 14 | `GrandTotal` | numeric(18,2) | NO |  |
| 15 | `Status` | varchar(20) | NO |  |
| 16 | `Notes` | text | yes |  |
| 17 | `Salutation` | varchar(200) | yes |  |
| 18 | `IntroLine` | varchar(500) | yes |  |
| 19 | `ClosingLine` | varchar(500) | yes |  |
| 20 | `CreatedBy` | integer | NO |  |
| 21 | `CreatedAt` | timestamp with time zone | NO |  |
| 22 | `LastModifiedBy` | integer | yes |  |
| 23 | `LastModifiedAt` | timestamp with time zone | yes |  |
| 24 | `IsDeleted` | boolean | NO | false |
| 25 | `DeletedBy` | integer | yes |  |
| 26 | `DeletedAt` | timestamp with time zone | yes |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE SET NULL`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedBy"`
- n: `NOT NULL "Discount"`
- n: `NOT NULL "GrandTotal"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "IsDeleted"`
- n: `NOT NULL "OwnerId"`
- n: `NOT NULL "QuoteDate"`
- n: `NOT NULL "QuoteNo"`
- n: `NOT NULL "Status"`
- n: `NOT NULL "Subtotal"`
- n: `NOT NULL "VatTotal"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_Quotations_CustomerId`
- `IX_Quotations_TenantId`
- `IX_Quotations_TenantId_QuoteNo`
- `Quotations_pkey`

### `RecurringExpenses`

Rows: **0** · owner: `hexabill_user` · columns: 16

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `OwnerId` | integer | NO |  |
| 3 | `TenantId` | integer | yes |  |
| 4 | `BranchId` | integer | yes |  |
| 5 | `CategoryId` | integer | NO |  |
| 6 | `Amount` | numeric(,) | NO |  |
| 7 | `Note` | varchar(500) | yes |  |
| 8 | `Frequency` | integer | NO |  |
| 9 | `DayOfRecurrence` | integer | yes |  |
| 10 | `StartDate` | timestamp with time zone | NO |  |
| 11 | `EndDate` | timestamp with time zone | yes |  |
| 12 | `IsActive` | boolean | NO |  |
| 13 | `CreatedBy` | integer | NO |  |
| 14 | `CreatedAt` | timestamp with time zone | NO |  |
| 15 | `UpdatedAt` | timestamp with time zone | NO |  |
| 16 | `CreatedByUserId` | integer | NO |  |

Constraints:
- n: `NOT NULL "Amount"`
- n: `NOT NULL "CategoryId"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedBy"`
- n: `NOT NULL "CreatedByUserId"`
- n: `NOT NULL "Frequency"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "IsActive"`
- n: `NOT NULL "OwnerId"`
- n: `NOT NULL "StartDate"`
- n: `NOT NULL "UpdatedAt"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_RecurringExpenses_BranchId`
- `IX_RecurringExpenses_CategoryId`
- `IX_RecurringExpenses_CreatedByUserId`
- `PK_RecurringExpenses`

### `RecurringInvoiceItems`

Rows: **0** · owner: `hexabill_user` · columns: 6

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `RecurringInvoiceId` | integer | NO |  |
| 3 | `ProductId` | integer | NO |  |
| 4 | `Qty` | numeric(,) | NO |  |
| 5 | `UnitPrice` | numeric(,) | NO |  |
| 6 | `UnitType` | text | NO |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("RecurringInvoiceId") REFERENCES "RecurringInvoices"("Id") ON DELETE CASCADE`
- n: `NOT NULL "Id"`
- n: `NOT NULL "ProductId"`
- n: `NOT NULL "Qty"`
- n: `NOT NULL "RecurringInvoiceId"`
- n: `NOT NULL "UnitPrice"`
- n: `NOT NULL "UnitType"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_RecurringInvoiceItems_ProductId`
- `IX_RecurringInvoiceItems_RecurringInvoiceId`
- `PK_RecurringInvoiceItems`

### `RecurringInvoices`

Rows: **0** · owner: `hexabill_user` · columns: 16

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `TenantId` | integer | NO |  |
| 3 | `CustomerId` | integer | NO |  |
| 4 | `BranchId` | integer | yes |  |
| 5 | `RouteId` | integer | yes |  |
| 6 | `Frequency` | integer | NO |  |
| 7 | `DayOfRecurrence` | integer | yes |  |
| 8 | `StartDate` | timestamp with time zone | NO |  |
| 9 | `EndDate` | timestamp with time zone | yes |  |
| 10 | `NextRunDate` | timestamp with time zone | NO |  |
| 11 | `LastRunDate` | timestamp with time zone | yes |  |
| 12 | `IsActive` | boolean | NO | true |
| 13 | `Notes` | text | yes |  |
| 14 | `CreatedBy` | integer | NO |  |
| 15 | `CreatedAt` | timestamp with time zone | NO |  |
| 16 | `UpdatedAt` | timestamp with time zone | NO |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("BranchId") REFERENCES "Branches"("Id")`
- FOREIGN KEY: `FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("RouteId") REFERENCES "Routes"("Id")`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedBy"`
- n: `NOT NULL "CustomerId"`
- n: `NOT NULL "Frequency"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "IsActive"`
- n: `NOT NULL "NextRunDate"`
- n: `NOT NULL "StartDate"`
- n: `NOT NULL "TenantId"`
- n: `NOT NULL "UpdatedAt"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_RecurringInvoices_BranchId`
- `IX_RecurringInvoices_CustomerId`
- `IX_RecurringInvoices_RouteId`
- `PK_RecurringInvoices`

### `RouteCustomers`

Rows: **47** · owner: `hexabill_user` · columns: 5

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `RouteId` | integer | NO |  |
| 3 | `CustomerId` | integer | NO |  |
| 4 | `AssignedAt` | timestamp with time zone | NO |  |
| 5 | `SortOrder` | integer | yes |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("RouteId") REFERENCES "Routes"("Id") ON DELETE CASCADE`
- n: `NOT NULL "AssignedAt"`
- n: `NOT NULL "CustomerId"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "RouteId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_RouteCustomers_CustomerId`
- `IX_RouteCustomers_RouteId`
- `IX_RouteCustomers_RouteId_CustomerId`
- `RouteCustomers_pkey`

### `RouteExpenses`

Rows: **0** · owner: `hexabill_user` · columns: 9

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `RouteId` | integer | NO |  |
| 3 | `TenantId` | integer | NO |  |
| 4 | `Category` | text | NO |  |
| 5 | `Amount` | numeric(18,2) | NO |  |
| 6 | `ExpenseDate` | timestamp with time zone | NO |  |
| 7 | `Description` | varchar(500) | yes |  |
| 8 | `CreatedBy` | integer | NO |  |
| 9 | `CreatedAt` | timestamp with time zone | NO |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("CreatedBy") REFERENCES "Users"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("RouteId") REFERENCES "Routes"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE CASCADE`
- n: `NOT NULL "Amount"`
- n: `NOT NULL "Category"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedBy"`
- n: `NOT NULL "ExpenseDate"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "RouteId"`
- n: `NOT NULL "TenantId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_RouteExpenses_CreatedBy`
- `IX_RouteExpenses_ExpenseDate`
- `IX_RouteExpenses_RouteId`
- `IX_RouteExpenses_TenantId`
- `RouteExpenses_pkey`

### `RouteStaff`

Rows: **1** · owner: `hexabill_user` · columns: 4

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `RouteId` | integer | NO |  |
| 3 | `UserId` | integer | NO |  |
| 4 | `AssignedAt` | timestamp with time zone | NO |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("RouteId") REFERENCES "Routes"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE`
- n: `NOT NULL "AssignedAt"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "RouteId"`
- n: `NOT NULL "UserId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_RouteStaff_RouteId`
- `IX_RouteStaff_RouteId_UserId`
- `IX_RouteStaff_UserId`
- `RouteStaff_pkey`

### `Routes`

Rows: **4** · owner: `hexabill_user` · columns: 8

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `BranchId` | integer | NO |  |
| 3 | `TenantId` | integer | NO |  |
| 4 | `Name` | varchar(200) | NO |  |
| 5 | `AssignedStaffId` | integer | yes |  |
| 6 | `CreatedAt` | timestamp with time zone | NO |  |
| 7 | `UpdatedAt` | timestamp with time zone | yes |  |
| 8 | `IsActive` | boolean | NO | true |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("AssignedStaffId") REFERENCES "Users"("Id") ON DELETE SET NULL`
- FOREIGN KEY: `FOREIGN KEY ("BranchId") REFERENCES "Branches"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE CASCADE`
- n: `NOT NULL "BranchId"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "IsActive"`
- n: `NOT NULL "Name"`
- n: `NOT NULL "TenantId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_Routes_AssignedStaffId`
- `IX_Routes_BranchId`
- `IX_Routes_TenantId`
- `Routes_pkey`

### `SalaryCertificates`

Rows: **7** · owner: `hexabill_user` · columns: 25

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO | nextval('"SalaryCertificates_Id_seq"'::regclass) |
| 2 | `OwnerId` | integer | NO |  |
| 3 | `TenantId` | integer | yes |  |
| 4 | `CertificateNo` | varchar(50) | NO |  |
| 5 | `CertificateDate` | timestamp with time zone | NO |  |
| 6 | `Recipient` | varchar(200) | yes |  |
| 7 | `EmployeeName` | varchar(200) | yes |  |
| 8 | `PassportNumber` | varchar(50) | yes |  |
| 9 | `EmployeeNationality` | varchar(100) | yes |  |
| 10 | `JoiningDate` | timestamp with time zone | yes |  |
| 11 | `Designation` | varchar(200) | yes |  |
| 12 | `MonthlySalary` | numeric(18,2) | yes |  |
| 13 | `MonthlySalaryWords` | varchar(200) | yes |  |
| 14 | `EmployeePhone` | varchar(50) | yes |  |
| 15 | `SignatoryName` | varchar(200) | NO | 'Sudheesh Thampi'::character varying |
| 16 | `SignatoryTitle` | varchar(100) | NO | 'Manager'::character varying |
| 17 | `Status` | varchar(20) | NO |  |
| 18 | `Notes` | text | yes |  |
| 19 | `CreatedBy` | integer | NO |  |
| 20 | `CreatedAt` | timestamp with time zone | NO |  |
| 21 | `LastModifiedBy` | integer | yes |  |
| 22 | `LastModifiedAt` | timestamp with time zone | yes |  |
| 23 | `IsDeleted` | boolean | NO | false |
| 24 | `DeletedBy` | integer | yes |  |
| 25 | `DeletedAt` | timestamp with time zone | yes |  |

Constraints:
- n: `NOT NULL "CertificateDate"`
- n: `NOT NULL "CertificateNo"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedBy"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "IsDeleted"`
- n: `NOT NULL "OwnerId"`
- n: `NOT NULL "SignatoryName"`
- n: `NOT NULL "SignatoryTitle"`
- n: `NOT NULL "Status"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_SalaryCertificates_TenantId`
- `IX_SalaryCertificates_TenantId_CertificateNo`
- `SalaryCertificates_pkey`

### `SaleItems`

Rows: **6634** · owner: `hexabill_user` · columns: 14

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `SaleId` | integer | NO |  |
| 3 | `ProductId` | integer | NO |  |
| 4 | `UnitType` | varchar(20) | NO |  |
| 5 | `Qty` | numeric(18,2) | NO |  |
| 6 | `UnitPrice` | numeric(18,2) | NO |  |
| 7 | `Discount` | numeric(18,2) | NO |  |
| 8 | `VatAmount` | numeric(18,2) | NO |  |
| 9 | `LineTotal` | numeric(18,2) | NO |  |
| 10 | `VatRate` | numeric(18,4) | NO | 0.0 |
| 11 | `VatScenario` | text | yes |  |
| 12 | `UnitCostAtSale` | numeric(18,6) | yes |  |
| 13 | `ConversionAtSale` | numeric(18,6) | yes |  |
| 14 | `CostCapturedAt` | timestamp with time zone | yes |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("SaleId") REFERENCES "Sales"("Id") ON DELETE CASCADE`
- n: `NOT NULL "Discount"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "LineTotal"`
- n: `NOT NULL "ProductId"`
- n: `NOT NULL "Qty"`
- n: `NOT NULL "SaleId"`
- n: `NOT NULL "UnitPrice"`
- n: `NOT NULL "UnitType"`
- n: `NOT NULL "VatAmount"`
- n: `NOT NULL "VatRate"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_SaleItems_ProductId`
- `IX_SaleItems_SaleId`
- `PK_SaleItems`

### `SaleReturnItems`

Rows: **3** · owner: `hexabill_user` · columns: 13

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `SaleReturnId` | integer | NO |  |
| 3 | `SaleItemId` | integer | NO |  |
| 4 | `ProductId` | integer | NO |  |
| 5 | `UnitType` | varchar(20) | NO |  |
| 6 | `Qty` | numeric(18,2) | NO |  |
| 7 | `UnitPrice` | numeric(18,2) | NO |  |
| 8 | `VatAmount` | numeric(18,2) | NO |  |
| 9 | `LineTotal` | numeric(18,2) | NO |  |
| 10 | `Reason` | varchar(200) | yes |  |
| 11 | `Condition` | varchar(20) | yes |  |
| 12 | `DamageCategoryId` | integer | yes |  |
| 13 | `StockEffect` | boolean | yes |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("SaleItemId") REFERENCES "SaleItems"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("SaleReturnId") REFERENCES "SaleReturns"("Id") ON DELETE CASCADE`
- n: `NOT NULL "Id"`
- n: `NOT NULL "LineTotal"`
- n: `NOT NULL "ProductId"`
- n: `NOT NULL "Qty"`
- n: `NOT NULL "SaleItemId"`
- n: `NOT NULL "SaleReturnId"`
- n: `NOT NULL "UnitPrice"`
- n: `NOT NULL "UnitType"`
- n: `NOT NULL "VatAmount"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_SaleReturnItems_ProductId`
- `IX_SaleReturnItems_SaleItemId`
- `IX_SaleReturnItems_SaleReturnId`
- `PK_SaleReturnItems`

### `SaleReturns`

Rows: **3** · owner: `hexabill_user` · columns: 22

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `OwnerId` | integer | NO |  |
| 3 | `TenantId` | integer | yes |  |
| 4 | `SaleId` | integer | NO |  |
| 5 | `CustomerId` | integer | yes |  |
| 6 | `ReturnNo` | varchar(100) | NO |  |
| 7 | `ReturnDate` | timestamp with time zone | NO |  |
| 8 | `Subtotal` | numeric(18,2) | NO |  |
| 9 | `VatTotal` | numeric(18,2) | NO |  |
| 10 | `Discount` | numeric(18,2) | NO |  |
| 11 | `GrandTotal` | numeric(18,2) | NO |  |
| 12 | `Reason` | varchar(500) | yes |  |
| 13 | `Status` | text | NO |  |
| 14 | `RestoreStock` | boolean | NO |  |
| 15 | `IsBadItem` | boolean | NO |  |
| 16 | `CreatedBy` | integer | NO |  |
| 17 | `CreatedAt` | timestamp with time zone | NO |  |
| 18 | `BranchId` | integer | yes |  |
| 19 | `RouteId` | integer | yes |  |
| 20 | `ReturnCategory` | varchar(20) | yes |  |
| 21 | `ReturnType` | varchar(20) | yes |  |
| 22 | `RefundStatus` | varchar(20) | yes |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("CreatedBy") REFERENCES "Users"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id")`
- FOREIGN KEY: `FOREIGN KEY ("SaleId") REFERENCES "Sales"("Id") ON DELETE CASCADE`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedBy"`
- n: `NOT NULL "Discount"`
- n: `NOT NULL "GrandTotal"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "IsBadItem"`
- n: `NOT NULL "OwnerId"`
- n: `NOT NULL "RestoreStock"`
- n: `NOT NULL "ReturnDate"`
- n: `NOT NULL "ReturnNo"`
- n: `NOT NULL "SaleId"`
- n: `NOT NULL "Status"`
- n: `NOT NULL "Subtotal"`
- n: `NOT NULL "VatTotal"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_SaleReturns_CreatedBy`
- `IX_SaleReturns_CustomerId`
- `IX_SaleReturns_SaleId`
- `IX_SaleReturns_TenantId_ReturnNo`
- `PK_SaleReturns`

### `Sales`

Rows: **1073** · owner: `hexabill_user` · columns: 35

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `OwnerId` | integer | NO |  |
| 3 | `TenantId` | integer | yes |  |
| 4 | `InvoiceNo` | varchar(100) | NO |  |
| 5 | `ExternalReference` | varchar(200) | yes |  |
| 6 | `InvoiceDate` | timestamp with time zone | NO |  |
| 7 | `CustomerId` | integer | yes |  |
| 8 | `Subtotal` | numeric(18,2) | NO |  |
| 9 | `VatTotal` | numeric(18,2) | NO |  |
| 10 | `Discount` | numeric(18,2) | NO |  |
| 11 | `GrandTotal` | numeric(18,2) | NO |  |
| 12 | `TotalAmount` | numeric(18,2) | NO |  |
| 13 | `PaidAmount` | numeric(18,2) | NO | 0.0 |
| 14 | `PaymentStatus` | text | NO |  |
| 15 | `LastPaymentDate` | timestamp with time zone | yes |  |
| 16 | `DueDate` | timestamp with time zone | yes |  |
| 17 | `Notes` | text | yes |  |
| 18 | `CreatedBy` | integer | NO |  |
| 19 | `CreatedAt` | timestamp with time zone | NO |  |
| 20 | `LastModifiedBy` | integer | yes |  |
| 21 | `LastModifiedAt` | timestamp with time zone | yes |  |
| 22 | `IsDeleted` | boolean | NO | false |
| 23 | `DeletedBy` | integer | yes |  |
| 24 | `DeletedAt` | timestamp with time zone | yes |  |
| 25 | `IsFinalized` | boolean | NO |  |
| 26 | `IsLocked` | boolean | NO | false |
| 27 | `LockedAt` | timestamp with time zone | yes |  |
| 28 | `EditReason` | varchar(500) | yes |  |
| 29 | `Version` | integer | NO | 1 |
| 30 | `RowVersion` | bytea | yes | '\x00'::bytea |
| 31 | `BranchId` | integer | yes |  |
| 32 | `RouteId` | integer | yes |  |
| 33 | `IsZeroInvoice` | boolean | NO | false |
| 34 | `VatScenario` | text | yes |  |
| 35 | `RoundOff` | numeric(,) | NO | 0 |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("BranchId") REFERENCES "Branches"("Id") ON DELETE SET NULL`
- FOREIGN KEY: `FOREIGN KEY ("CreatedBy") REFERENCES "Users"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id")`
- FOREIGN KEY: `FOREIGN KEY ("DeletedBy") REFERENCES "Users"("Id")`
- FOREIGN KEY: `FOREIGN KEY ("LastModifiedBy") REFERENCES "Users"("Id")`
- FOREIGN KEY: `FOREIGN KEY ("RouteId") REFERENCES "Routes"("Id") ON DELETE SET NULL`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedBy"`
- n: `NOT NULL "Discount"`
- n: `NOT NULL "GrandTotal"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "InvoiceDate"`
- n: `NOT NULL "InvoiceNo"`
- n: `NOT NULL "IsDeleted"`
- n: `NOT NULL "IsFinalized"`
- n: `NOT NULL "IsLocked"`
- n: `NOT NULL "IsZeroInvoice"`
- n: `NOT NULL "OwnerId"`
- n: `NOT NULL "PaidAmount"`
- n: `NOT NULL "PaymentStatus"`
- n: `NOT NULL "RoundOff"`
- n: `NOT NULL "Subtotal"`
- n: `NOT NULL "TotalAmount"`
- n: `NOT NULL "VatTotal"`
- n: `NOT NULL "Version"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_Sales_BranchId`
- `IX_Sales_CreatedAt`
- `IX_Sales_CreatedBy`
- `IX_Sales_CustomerId`
- `IX_Sales_DeletedBy`
- `IX_Sales_ExternalReference`
- `IX_Sales_IsLocked`
- `IX_Sales_LastModifiedBy`
- `IX_Sales_OwnerId_InvoiceNo`
- `IX_Sales_RouteId`
- `IX_Sales_TenantId_CustomerId`
- `IX_Sales_TenantId_InvoiceDate_IsDeleted`
- `IX_Sales_TenantId_PaymentStatus`
- `IX_Sales_TenantId_RouteId`
- `PK_Sales`
- `idx_sales_tenant_deleted`
- `idx_sales_tenant_invoicedate`

### `Settings`

Rows: **189** · owner: `hexabill_user` · columns: 6

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Key` | varchar(100) | NO |  |
| 2 | `OwnerId` | integer | NO |  |
| 3 | `TenantId` | integer | yes |  |
| 4 | `Value` | text | yes |  |
| 5 | `CreatedAt` | timestamp with time zone | NO |  |
| 6 | `UpdatedAt` | timestamp with time zone | NO |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id")`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "Key"`
- n: `NOT NULL "OwnerId"`
- n: `NOT NULL "UpdatedAt"`
- PRIMARY KEY: `PRIMARY KEY ("Key", "OwnerId")`

Indexes:
- `IX_Settings_OwnerId`
- `IX_Settings_TenantId`
- `PK_Settings`

### `SubscriptionPlans`

Rows: **1** · owner: `hexabill_user` · columns: 21

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `Name` | varchar(100) | NO |  |
| 3 | `Description` | varchar(500) | yes |  |
| 4 | `MonthlyPrice` | numeric(,) | NO |  |
| 5 | `YearlyPrice` | numeric(,) | NO |  |
| 6 | `Currency` | text | NO |  |
| 7 | `MaxUsers` | integer | NO |  |
| 8 | `MaxInvoicesPerMonth` | integer | NO |  |
| 9 | `MaxCustomers` | integer | NO |  |
| 10 | `MaxProducts` | integer | NO |  |
| 11 | `MaxStorageMB` | bigint | NO |  |
| 12 | `HasAdvancedReports` | boolean | NO |  |
| 13 | `HasApiAccess` | boolean | NO |  |
| 14 | `HasWhiteLabel` | boolean | NO |  |
| 15 | `HasPrioritySupport` | boolean | NO |  |
| 16 | `HasCustomBranding` | boolean | NO |  |
| 17 | `TrialDays` | integer | NO |  |
| 18 | `IsActive` | boolean | NO |  |
| 19 | `DisplayOrder` | integer | NO |  |
| 20 | `CreatedAt` | timestamp with time zone | NO |  |
| 21 | `UpdatedAt` | timestamp with time zone | yes |  |

Constraints:
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "Currency"`
- n: `NOT NULL "DisplayOrder"`
- n: `NOT NULL "HasAdvancedReports"`
- n: `NOT NULL "HasApiAccess"`
- n: `NOT NULL "HasCustomBranding"`
- n: `NOT NULL "HasPrioritySupport"`
- n: `NOT NULL "HasWhiteLabel"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "IsActive"`
- n: `NOT NULL "MaxCustomers"`
- n: `NOT NULL "MaxInvoicesPerMonth"`
- n: `NOT NULL "MaxProducts"`
- n: `NOT NULL "MaxStorageMB"`
- n: `NOT NULL "MaxUsers"`
- n: `NOT NULL "MonthlyPrice"`
- n: `NOT NULL "Name"`
- n: `NOT NULL "TrialDays"`
- n: `NOT NULL "YearlyPrice"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `PK_SubscriptionPlans`

### `Subscriptions`

Rows: **4** · owner: `hexabill_user` · columns: 19

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `TenantId` | integer | NO |  |
| 3 | `PlanId` | integer | NO |  |
| 4 | `Status` | integer | NO |  |
| 5 | `BillingCycle` | integer | NO |  |
| 6 | `StartDate` | timestamp with time zone | NO |  |
| 7 | `EndDate` | timestamp with time zone | yes |  |
| 8 | `TrialEndDate` | timestamp with time zone | yes |  |
| 9 | `CancelledAt` | timestamp with time zone | yes |  |
| 10 | `CancellationReason` | varchar(500) | yes |  |
| 11 | `ExpiresAt` | timestamp with time zone | yes |  |
| 12 | `NextBillingDate` | timestamp with time zone | yes |  |
| 13 | `Amount` | numeric(18,2) | NO |  |
| 14 | `Currency` | varchar(10) | NO |  |
| 15 | `PaymentGatewaySubscriptionId` | varchar(200) | yes |  |
| 16 | `PaymentGatewayCustomerId` | varchar(200) | yes |  |
| 17 | `PaymentMethod` | varchar(50) | yes |  |
| 18 | `CreatedAt` | timestamp with time zone | NO |  |
| 19 | `UpdatedAt` | timestamp with time zone | yes |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("PlanId") REFERENCES "SubscriptionPlans"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE CASCADE`
- n: `NOT NULL "Amount"`
- n: `NOT NULL "BillingCycle"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "Currency"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "PlanId"`
- n: `NOT NULL "StartDate"`
- n: `NOT NULL "Status"`
- n: `NOT NULL "TenantId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_Subscriptions_PlanId`
- `IX_Subscriptions_TenantId`
- `PK_Subscriptions`

### `SupplierCategories`

Rows: **0** · owner: `hexabill_user` · columns: 5

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO | nextval('"SupplierCategories_Id_seq"'::regclass) |
| 2 | `TenantId` | integer | yes |  |
| 3 | `Name` | varchar(100) | NO |  |
| 4 | `IsActive` | boolean | NO | true |
| 5 | `CreatedAt` | timestamp with time zone | NO | (now() AT TIME ZONE 'utc'::text) |

Constraints:
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "IsActive"`
- n: `NOT NULL "Name"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_SupplierCategories_TenantId_Name`
- `SupplierCategories_pkey`

### `SupplierLedgerCredits`

Rows: **18** · owner: `hexabill_user` · columns: 9

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO | nextval('"SupplierLedgerCredits_Id_seq"'::regclass) |
| 2 | `TenantId` | integer | NO |  |
| 3 | `SupplierName` | varchar(200) | NO |  |
| 4 | `Amount` | numeric(18,2) | NO |  |
| 5 | `CreditDate` | timestamp with time zone | NO |  |
| 6 | `CreditType` | varchar(50) | NO |  |
| 7 | `Notes` | varchar(500) | yes |  |
| 8 | `CreatedBy` | integer | NO |  |
| 9 | `CreatedAt` | timestamp with time zone | NO | (now() AT TIME ZONE 'utc'::text) |

Constraints:
- n: `NOT NULL "Amount"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedBy"`
- n: `NOT NULL "CreditDate"`
- n: `NOT NULL "CreditType"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "SupplierName"`
- n: `NOT NULL "TenantId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_SupplierLedgerCredits_CreditDate`
- `IX_SupplierLedgerCredits_TenantId_SupplierName`
- `SupplierLedgerCredits_pkey`

### `SupplierPayments`

Rows: **28** · owner: `hexabill_user` · columns: 12

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO | nextval('"SupplierPayments_Id_seq"'::regclass) |
| 2 | `TenantId` | integer | yes |  |
| 3 | `SupplierId` | integer | yes |  |
| 4 | `Amount` | numeric(18,2) | NO |  |
| 5 | `PaymentDate` | timestamp with time zone | NO |  |
| 6 | `Reference` | varchar(200) | yes |  |
| 7 | `PurchaseId` | integer | yes |  |
| 8 | `CreatedAt` | timestamp with time zone | NO | (now() AT TIME ZONE 'utc'::text) |
| 9 | `SupplierName` | varchar(200) | yes |  |
| 10 | `Mode` | varchar(20) | yes |  |
| 11 | `Notes` | varchar(500) | yes |  |
| 12 | `CreatedBy` | integer | NO | 1 |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("PurchaseId") REFERENCES "Purchases"("Id") ON DELETE SET NULL`
- FOREIGN KEY: `FOREIGN KEY ("SupplierId") REFERENCES "Suppliers"("Id") ON DELETE RESTRICT`
- n: `NOT NULL "Amount"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedBy"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "PaymentDate"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_SupplierPayments_PaymentDate`
- `IX_SupplierPayments_PurchaseId`
- `IX_SupplierPayments_SupplierId`
- `SupplierPayments_pkey`

### `Suppliers`

Rows: **19** · owner: `hexabill_user` · columns: 15

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO | nextval('"Suppliers_Id_seq"'::regclass) |
| 2 | `TenantId` | integer | yes |  |
| 3 | `Name` | varchar(200) | NO |  |
| 4 | `NormalizedName` | varchar(200) | NO |  |
| 5 | `Phone` | varchar(50) | yes |  |
| 6 | `Address` | varchar(500) | yes |  |
| 7 | `CategoryId` | integer | yes |  |
| 8 | `OpeningBalance` | numeric(18,2) | NO | 0 |
| 9 | `IsActive` | boolean | NO | true |
| 10 | `CreatedAt` | timestamp with time zone | NO | (now() AT TIME ZONE 'utc'::text) |
| 11 | `UpdatedAt` | timestamp with time zone | yes |  |
| 12 | `Email` | varchar(200) | yes |  |
| 13 | `CreditLimit` | numeric(18,2) | NO | 0 |
| 14 | `PaymentTerms` | varchar(100) | yes |  |
| 15 | `SupplierCategoryId` | integer | yes |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("CategoryId") REFERENCES "SupplierCategories"("Id") ON DELETE SET NULL`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreditLimit"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "IsActive"`
- n: `NOT NULL "Name"`
- n: `NOT NULL "NormalizedName"`
- n: `NOT NULL "OpeningBalance"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_Suppliers_CategoryId`
- `IX_Suppliers_TenantId_NormalizedName`
- `Suppliers_pkey`

### `SupportSessions`

Rows: **9** · owner: `hexabill_user` · columns: 8

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `TenantId` | integer | NO |  |
| 3 | `PlatformUserId` | integer | NO |  |
| 4 | `Reason` | varchar(500) | NO |  |
| 5 | `StartedAt` | timestamp with time zone | NO |  |
| 6 | `ExpiresAt` | timestamp with time zone | NO |  |
| 7 | `EndedAt` | timestamp with time zone | yes |  |
| 8 | `ReadOnly` | boolean | NO |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("PlatformUserId") REFERENCES "Users"("Id") ON DELETE RESTRICT`
- FOREIGN KEY: `FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE CASCADE`
- n: `NOT NULL "ExpiresAt"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "PlatformUserId"`
- n: `NOT NULL "ReadOnly"`
- n: `NOT NULL "Reason"`
- n: `NOT NULL "StartedAt"`
- n: `NOT NULL "TenantId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_SupportSessions_TenantId_PlatformUserId_ExpiresAt`
- `SupportSessions_pkey`

### `TenantDocumentVersions`

Rows: **0** · owner: `hexabill_user` · columns: 15

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | uuid | NO |  |
| 2 | `TenantId` | integer | NO |  |
| 3 | `DocumentId` | uuid | NO |  |
| 4 | `VersionNumber` | integer | NO |  |
| 5 | `OriginalFileName` | varchar(200) | NO |  |
| 6 | `ContentType` | varchar(100) | NO |  |
| 7 | `SizeBytes` | bigint | NO |  |
| 8 | `Sha256` | varchar(64) | NO |  |
| 9 | `StorageKey` | varchar(300) | NO |  |
| 10 | `Status` | varchar(20) | NO |  |
| 11 | `ExpiresOn` | timestamp with time zone | yes |  |
| 12 | `UploadedByUserId` | integer | NO |  |
| 13 | `UploadedAt` | timestamp with time zone | NO |  |
| 14 | `ReviewedByUserId` | integer | yes |  |
| 15 | `ReviewedAt` | timestamp with time zone | yes |  |

Constraints:
- n: `NOT NULL "ContentType"`
- n: `NOT NULL "DocumentId"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "OriginalFileName"`
- n: `NOT NULL "Sha256"`
- n: `NOT NULL "SizeBytes"`
- n: `NOT NULL "Status"`
- n: `NOT NULL "StorageKey"`
- n: `NOT NULL "TenantId"`
- n: `NOT NULL "UploadedAt"`
- n: `NOT NULL "UploadedByUserId"`
- n: `NOT NULL "VersionNumber"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_TenantDocumentVersions_TenantId_DocumentId_VersionNumber`
- `PK_TenantDocumentVersions`

### `TenantDocuments`

Rows: **0** · owner: `hexabill_user` · columns: 11

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | uuid | NO |  |
| 2 | `TenantId` | integer | NO |  |
| 3 | `Title` | varchar(200) | NO |  |
| 4 | `DocType` | varchar(20) | NO |  |
| 5 | `Visibility` | varchar(20) | NO |  |
| 6 | `Status` | varchar(20) | NO |  |
| 7 | `CurrentVersionId` | uuid | yes |  |
| 8 | `CreatedByUserId` | integer | NO |  |
| 9 | `CreatedAt` | timestamp with time zone | NO |  |
| 10 | `UpdatedAt` | timestamp with time zone | NO |  |
| 11 | `DeletedAt` | timestamp with time zone | yes |  |

Constraints:
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedByUserId"`
- n: `NOT NULL "DocType"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "Status"`
- n: `NOT NULL "TenantId"`
- n: `NOT NULL "Title"`
- n: `NOT NULL "UpdatedAt"`
- n: `NOT NULL "Visibility"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_TenantDocuments_TenantId_Status`
- `PK_TenantDocuments`

### `TenantInvites`

Rows: **2** · owner: `hexabill_user` · columns: 10

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `TenantId` | integer | NO |  |
| 3 | `UserId` | integer | NO |  |
| 4 | `TokenHash` | varchar(128) | NO |  |
| 5 | `HostSubdomain` | varchar(30) | NO |  |
| 6 | `CreatedAt` | timestamp with time zone | NO |  |
| 7 | `ExpiresAt` | timestamp with time zone | NO |  |
| 8 | `UsedAt` | timestamp with time zone | yes |  |
| 9 | `RevokedAt` | timestamp with time zone | yes |  |
| 10 | `CreatedByUserId` | integer | NO |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedByUserId"`
- n: `NOT NULL "ExpiresAt"`
- n: `NOT NULL "HostSubdomain"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "TenantId"`
- n: `NOT NULL "TokenHash"`
- n: `NOT NULL "UserId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_TenantInvites_TenantId_UserId_ExpiresAt`
- `IX_TenantInvites_TokenHash`
- `TenantInvites_pkey`

### `TenantVatBasisHistory`

Rows: **0** · owner: `hexabill_user` · columns: 6

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `TenantId` | integer | NO |  |
| 3 | `Basis` | varchar(20) | NO |  |
| 4 | `EffectiveFrom` | timestamp with time zone | NO |  |
| 5 | `SetByUserId` | integer | NO |  |
| 6 | `CreatedAt` | timestamp with time zone | NO |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("SetByUserId") REFERENCES "Users"("Id") ON DELETE RESTRICT`
- FOREIGN KEY: `FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE RESTRICT`
- n: `NOT NULL "Basis"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "EffectiveFrom"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "SetByUserId"`
- n: `NOT NULL "TenantId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_TenantVatBasisHistory_SetByUserId`
- `IX_TenantVatBasisHistory_TenantId_EffectiveFrom`
- `PK_TenantVatBasisHistory`

### `Tenants`

Rows: **5** · owner: `hexabill_user` · columns: 20

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `Name` | varchar(200) | NO |  |
| 3 | `Subdomain` | varchar(100) | NO |  |
| 4 | `Domain` | varchar(200) | yes |  |
| 5 | `Country` | varchar(10) | NO | 'AE'::character varying |
| 6 | `Currency` | varchar(10) | NO | 'AED'::character varying |
| 7 | `VatNumber` | varchar(50) | yes |  |
| 8 | `CompanyNameEn` | varchar(200) | yes |  |
| 9 | `CompanyNameAr` | varchar(200) | yes |  |
| 10 | `Address` | varchar(500) | yes |  |
| 11 | `Phone` | varchar(20) | yes |  |
| 12 | `Email` | varchar(100) | yes |  |
| 13 | `LogoPath` | varchar(500) | yes |  |
| 14 | `Status` | text | NO | 'Active'::text |
| 15 | `CreatedAt` | timestamp with time zone | NO |  |
| 16 | `TrialEndDate` | timestamp with time zone | yes |  |
| 17 | `SuspendedAt` | timestamp with time zone | yes |  |
| 18 | `SuspensionReason` | varchar(500) | yes |  |
| 19 | `FeaturesJson` | varchar(2000) | yes |  |
| 20 | `VatCalculationBasis` | varchar(20) | NO | 'SalesBased'::character varying |

Constraints:
- n: `NOT NULL "Country"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "Currency"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "Name"`
- n: `NOT NULL "Status"`
- n: `NOT NULL "Subdomain"`
- n: `NOT NULL "VatCalculationBasis"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_Tenants_Domain`
- `IX_Tenants_Subdomain`
- `PK_Tenants`

### `UserSessions`

Rows: **327** · owner: `hexabill_user` · columns: 6

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO | nextval('"UserSessions_Id_seq"'::regclass) |
| 2 | `UserId` | integer | NO |  |
| 3 | `TenantId` | integer | NO |  |
| 4 | `LoginAt` | timestamp with time zone | NO |  |
| 5 | `UserAgent` | varchar(500) | yes |  |
| 6 | `IpAddress` | varchar(45) | yes |  |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE`
- n: `NOT NULL "Id"`
- n: `NOT NULL "LoginAt"`
- n: `NOT NULL "TenantId"`
- n: `NOT NULL "UserId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_UserSessions_LoginAt`
- `IX_UserSessions_TenantId`
- `UserSessions_pkey`

### `Users`

Rows: **11** · owner: `hexabill_user` · columns: 19

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `Name` | varchar(100) | NO |  |
| 3 | `Email` | varchar(100) | NO |  |
| 4 | `PasswordHash` | text | NO |  |
| 5 | `Role` | text | NO |  |
| 6 | `OwnerId` | integer | yes |  |
| 7 | `TenantId` | integer | yes |  |
| 8 | `Phone` | varchar(20) | yes |  |
| 9 | `DashboardPermissions` | text | yes |  |
| 10 | `CreatedAt` | timestamp with time zone | NO |  |
| 11 | `SessionVersion` | integer | NO | 0 |
| 12 | `ProfilePhotoUrl` | varchar(500) | yes |  |
| 13 | `LanguagePreference` | varchar(10) | yes |  |
| 14 | `LastLoginAt` | timestamp with time zone | yes |  |
| 15 | `LastActiveAt` | timestamp with time zone | yes |  |
| 16 | `PageAccess` | varchar(500) | yes |  |
| 17 | `IsPlatformAdmin` | boolean | NO | false |
| 18 | `IsActive` | boolean | NO | true |
| 19 | `MustChangePassword` | boolean | NO | false |

Constraints:
- CHECK: `CHECK (((("IsPlatformAdmin" = true) AND ("TenantId" IS NULL)) OR (("IsPlatformAdmin" = false) AND ("TenantId" IS NOT NULL))))`
- FOREIGN KEY: `FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id")`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "Email"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "IsActive"`
- n: `NOT NULL "IsPlatformAdmin"`
- n: `NOT NULL "MustChangePassword"`
- n: `NOT NULL "Name"`
- n: `NOT NULL "PasswordHash"`
- n: `NOT NULL "Role"`
- n: `NOT NULL "SessionVersion"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_Users_TenantId`
- `IX_Users_TenantId_Email`
- `PK_Users`
- `idx_users_ownerid`

### `VatReturnPeriods`

Rows: **10** · owner: `hexabill_user` · columns: 38

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO |  |
| 2 | `TenantId` | integer | NO |  |
| 3 | `PeriodType` | text | NO |  |
| 4 | `PeriodLabel` | text | NO |  |
| 5 | `PeriodStart` | timestamp with time zone | NO |  |
| 6 | `PeriodEnd` | timestamp with time zone | NO |  |
| 7 | `DueDate` | timestamp with time zone | NO |  |
| 8 | `Status` | text | NO |  |
| 9 | `Box1a` | numeric(18,4) | NO |  |
| 10 | `Box1b` | numeric(18,4) | NO |  |
| 11 | `Box2` | numeric(18,4) | NO |  |
| 12 | `Box3` | numeric(18,4) | NO |  |
| 13 | `Box4` | numeric(18,4) | NO |  |
| 14 | `Box9b` | numeric(18,4) | NO |  |
| 15 | `Box10` | numeric(18,4) | NO |  |
| 16 | `Box11` | numeric(18,4) | NO |  |
| 17 | `Box12` | numeric(18,4) | NO |  |
| 18 | `Box13a` | numeric(18,4) | NO |  |
| 19 | `Box13b` | numeric(18,4) | NO |  |
| 20 | `PetroleumExcluded` | numeric(18,4) | NO |  |
| 21 | `CalculatedAt` | timestamp with time zone | yes |  |
| 22 | `SubmittedAt` | timestamp with time zone | yes |  |
| 23 | `SubmittedByUserId` | integer | yes |  |
| 24 | `LockedAt` | timestamp with time zone | yes |  |
| 25 | `LockedByUserId` | integer | yes |  |
| 26 | `Notes` | text | yes |  |
| 27 | `SnapshotJson` | text | yes |  |
| 28 | `SnapshotHash` | text | yes |  |
| 29 | `SnapshotHistoryJson` | text | yes |  |
| 30 | `SnapshotVersion` | integer | NO | 0 |
| 31 | `SnapshotAt` | timestamp with time zone | yes |  |
| 32 | `CalculationVersion` | integer | NO | 0 |
| 33 | `SourceFingerprint` | text | yes |  |
| 34 | `ReviewedAt` | timestamp with time zone | yes |  |
| 35 | `ReviewedByUserId` | integer | yes |  |
| 36 | `ReviewedCalculationVersion` | integer | yes |  |
| 37 | `ReviewInvalidatedAt` | timestamp with time zone | yes |  |
| 38 | `ReviewInvalidatedReason` | text | yes |  |

Constraints:
- n: `NOT NULL "Box10"`
- n: `NOT NULL "Box11"`
- n: `NOT NULL "Box12"`
- n: `NOT NULL "Box13a"`
- n: `NOT NULL "Box13b"`
- n: `NOT NULL "Box1a"`
- n: `NOT NULL "Box1b"`
- n: `NOT NULL "Box2"`
- n: `NOT NULL "Box3"`
- n: `NOT NULL "Box4"`
- n: `NOT NULL "Box9b"`
- n: `NOT NULL "CalculationVersion"`
- n: `NOT NULL "DueDate"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "PeriodEnd"`
- n: `NOT NULL "PeriodLabel"`
- n: `NOT NULL "PeriodStart"`
- n: `NOT NULL "PeriodType"`
- n: `NOT NULL "PetroleumExcluded"`
- n: `NOT NULL "SnapshotVersion"`
- n: `NOT NULL "Status"`
- n: `NOT NULL "TenantId"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_VatReturnPeriods_TenantId`
- `IX_VatReturnPeriods_TenantId_PeriodStart_PeriodEnd`
- `PK_VatReturnPeriods`

### `VendorDiscounts`

Rows: **13** · owner: `hexabill_user` · columns: 12

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `Id` | integer | NO | nextval('"VendorDiscounts_Id_seq"'::regclass) |
| 2 | `TenantId` | integer | NO |  |
| 3 | `SupplierId` | integer | NO |  |
| 4 | `PurchaseId` | integer | yes |  |
| 5 | `Amount` | numeric(18,2) | NO |  |
| 6 | `DiscountDate` | timestamp with time zone | NO |  |
| 7 | `DiscountType` | varchar(50) | NO |  |
| 8 | `Reason` | varchar(500) | NO | ''::character varying |
| 9 | `IsActive` | boolean | NO | true |
| 10 | `CreatedBy` | integer | NO |  |
| 11 | `CreatedAt` | timestamp with time zone | NO | (now() AT TIME ZONE 'utc'::text) |
| 12 | `UpdatedAt` | timestamp with time zone | NO | (now() AT TIME ZONE 'utc'::text) |

Constraints:
- FOREIGN KEY: `FOREIGN KEY ("CreatedBy") REFERENCES "Users"("Id") ON DELETE CASCADE`
- FOREIGN KEY: `FOREIGN KEY ("PurchaseId") REFERENCES "Purchases"("Id") ON DELETE SET NULL`
- FOREIGN KEY: `FOREIGN KEY ("SupplierId") REFERENCES "Suppliers"("Id") ON DELETE RESTRICT`
- n: `NOT NULL "Amount"`
- n: `NOT NULL "CreatedAt"`
- n: `NOT NULL "CreatedBy"`
- n: `NOT NULL "DiscountDate"`
- n: `NOT NULL "DiscountType"`
- n: `NOT NULL "Id"`
- n: `NOT NULL "IsActive"`
- n: `NOT NULL "Reason"`
- n: `NOT NULL "SupplierId"`
- n: `NOT NULL "TenantId"`
- n: `NOT NULL "UpdatedAt"`
- PRIMARY KEY: `PRIMARY KEY ("Id")`

Indexes:
- `IX_VendorDiscounts_CreatedBy`
- `IX_VendorDiscounts_PurchaseId`
- `IX_VendorDiscounts_SupplierId`
- `IX_VendorDiscounts_TenantId`
- `VendorDiscounts_pkey`

### `__EFMigrationsHistory`

Rows: **59** · owner: `hexabill_user` · columns: 2

| # | Column | Type | Null | Default |
|---|---|---|---|---|
| 1 | `MigrationId` | varchar(150) | NO |  |
| 2 | `ProductVersion` | varchar(32) | NO |  |

Constraints:
- n: `NOT NULL "MigrationId"`
- n: `NOT NULL "ProductVersion"`
- PRIMARY KEY: `PRIMARY KEY ("MigrationId")`

Indexes:
- `PK___EFMigrationsHistory`

