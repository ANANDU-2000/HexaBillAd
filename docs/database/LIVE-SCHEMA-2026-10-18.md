# Live PostgreSQL schema reference

Captured: 2026-10-18T03:20:40.261180+00:00. Database: `hexabill`. PostgreSQL: `18.6 (Debian 18.6-1.pgdg12+2)`.

Public tables: **70**. Columns: **909**.

Read-only catalog inspection. IDs below describe primary/foreign keys and identity sequences; customer, staff and financial records, live row IDs, credentials and stored document contents are excluded.

## Migration history

| Migration ID | EF version |
|---|---|
| 20260214070330_InitialPostgreSQL | 9.0.0 |
| 20260214173227_AddBranchAndRoute | 9.0.0 |
| 20260215070856_AddBranchIdToExpense | 9.0.0 |
| 20260215095609_AddMissingTables | 9.0.0 |
| 20260215150153_EnterpriseBranchRoutePlan | 9.0.0 |
| 20260215165632_FixBooleanColumnsType | 9.0.0 |
| 20260215215659_AddUserSessionVersion | 9.0.0 |
| 20260217111415_AddHeldInvoiceTable | 9.0.0 |
| 20260217134457_AddProductsFeatures | 9.0.0 |
| 20260218024142_AddExpenseRouteId | 9.0.0 |
| 20260219062317_AddDamageCategoriesAndReturnExtensions | 9.0.0 |
| 20260219100000_EnsureSettingsValueColumnPascalCase | 9.0.0 |
| 20260219124000_AddFeaturesJsonToTenants | 9.0.0 |
| 20260220100000_AddUserPageAccess | 9.0.0 |
| 20260221100000_FixBranchStaffRouteStaffIdIdentity | 9.0.0 |
| 20260221120000_AddReturnCategoryAndCondition | 9.0.0 |
| 20260221120100_AddDamageInventory | 9.0.0 |
| 20260221120200_AddCreditNotes | 9.0.0 |
| 20260225120000_AddInvoiceTemplateTenantId | 9.0.0 |
| 20260225130000_AddExpenseCategoryTenantId | 9.0.0 |
| 20260305130821_AddSuppliersAndSupplierPayments | 9.0.0 |
| 20260305131600_AddPurchasePaymentType | 9.0.0 |
| 20260305162552_AddSupplierAndSupplierPayment | 9.0.0 |
| 20260307135822_AddVendorDiscountsTable | 10.0.3 |
| 20260310151454_AddVatReturnEngineFields | 9.0.0 |
| 20260310165519_AddRoundOffToSalesAndHeldInvoices | 9.0.0 |
| 20260310170435_AddPaymentReceiptsTable | 9.0.0 |
| 20260310172228_AddExpenseCategoryVatDefaults | 9.0.0 |
| 20260315060146_BackfillPurchaseIsTaxClaimable | 9.0.0 |
| 20260719171633_AddQuotationsAndAgreements | 9.0.0 |
| 20260719190000_AddQuotationLetterFields | 9.0.0 |
| 20260728120000_AddSalaryCertificates | 9.0.0 |
| 20260809180000_AddCustomerLocation | 9.0.0 |
| 20260810120000_AddCustomerItemPrices | 9.0.0 |
| 20260810210000_AddCustomerStopLocation | 9.0.0 |
| 20260920030000_Run1IdentityFields | 9.0.0 |
| 20260920033000_EnforceTenantSubdomains | 9.0.0 |
| 20260920050000_SecureOnboardingAndSupport | 9.0.0 |
| 20260927080000_AddTenantVatCalculationBasis | 9.0.0 |
| 20260927190000_AddBackupAgentDevices | 9.0.0 |
| 20261003090000_AddPaymentReceiptSnapshot | 9.0.0 |
| 20261003110000_AddSaleItemCostBasis | 9.0.0 |
| 20261003120000_AddPurchaseItemConversionAtPurchase | 9.0.0 |
| 20261003130000_AddPurchaseItemCostCapturedAt | 9.0.0 |
| 20261003140000_AddPaymentSettlementAdjustmentFlag | 9.0.0 |
| 20261003150000_AddDailyCashClose | 9.0.0 |
| 20261003160000_AddDailyCashCloseBankSnapshot | 9.0.0 |
| 20261003170000_AddExpensePaidFrom | 9.0.0 |
| 20261003180000_AddCashDrawerMovement | 9.0.0 |
| 20261003190000_AddPaymentParentPaymentId | 9.0.0 |
| 20261010090000_AddVatManagementSnapshot | 9.0.0 |
| 20261010120000_AddVatCalculationVersioning | 9.0.0 |
| 20261013090000_PreserveProductConversionPrecision | 9.0.0 |
| 20261017100000_ScopeSaleReturnNumberToTenant | 9.0.0 |
| 20261017110000_ScopePurchaseReturnNumberToTenant | 9.0.0 |
| 20261017120000_DeclareProductBarcodeUniqueIndex | 9.0.0 |
| 20261018090000_AddAssistantDrafts | 9.0.0 |
| 20261018120000_AddTenantDocuments | 9.0.0 |
| 20261018130000_BackfillCustomerOwnerId | 9.0.0 |

## Agreements

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO | nextval('"Agreements_Id_seq"'::regclass) | NO |
| OwnerId | integer | NO |  | NO |
| TenantId | integer | YES |  | NO |
| AgreementNo | varchar(50) | NO |  | NO |
| AgreementDate | timestamp with time zone | NO |  | NO |
| SecondPartyName | varchar(200) | YES |  | NO |
| SecondPartyLicense | varchar(100) | YES |  | NO |
| SecondPartyAddress | varchar(500) | YES |  | NO |
| SecondPartyMobile | varchar(50) | YES |  | NO |
| TemplateVersion | varchar(20) | NO |  | NO |
| Status | varchar(20) | NO |  | NO |
| Notes | text | YES |  | NO |
| CreatedBy | integer | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| LastModifiedBy | integer | YES |  | NO |
| LastModifiedAt | timestamp with time zone | YES |  | NO |
| IsDeleted | boolean | NO | false | NO |
| DeletedBy | integer | YES |  | NO |
| DeletedAt | timestamp with time zone | YES |  | NO |

| Constraint | Definition |
|---|---|
| Agreements_AgreementDate_not_null | NOT NULL "AgreementDate" |
| Agreements_AgreementNo_not_null | NOT NULL "AgreementNo" |
| Agreements_CreatedAt_not_null | NOT NULL "CreatedAt" |
| Agreements_CreatedBy_not_null | NOT NULL "CreatedBy" |
| Agreements_Id_not_null | NOT NULL "Id" |
| Agreements_IsDeleted_not_null | NOT NULL "IsDeleted" |
| Agreements_OwnerId_not_null | NOT NULL "OwnerId" |
| Agreements_Status_not_null | NOT NULL "Status" |
| Agreements_TemplateVersion_not_null | NOT NULL "TemplateVersion" |
| Agreements_pkey | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| Agreements_pkey | CREATE UNIQUE INDEX "Agreements_pkey" ON public."Agreements" USING btree ("Id") |
| IX_Agreements_TenantId | CREATE INDEX "IX_Agreements_TenantId" ON public."Agreements" USING btree ("TenantId") |
| IX_Agreements_TenantId_AgreementNo | CREATE UNIQUE INDEX "IX_Agreements_TenantId_AgreementNo" ON public."Agreements" USING btree ("TenantId", "AgreementNo") WHERE ("IsDeleted" = false) |

## Alerts

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| OwnerId | integer | NO |  | NO |
| TenantId | integer | YES |  | NO |
| Type | varchar(100) | NO |  | NO |
| Title | varchar(200) | NO |  | NO |
| Message | varchar(2000) | YES |  | NO |
| Severity | varchar(50) | NO |  | NO |
| IsRead | boolean | NO |  | NO |
| IsResolved | boolean | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| ReadAt | timestamp with time zone | YES |  | NO |
| ResolvedAt | timestamp with time zone | YES |  | NO |
| ResolvedBy | integer | YES |  | NO |
| Metadata | varchar(500) | YES |  | NO |

| Constraint | Definition |
|---|---|
| Alerts_CreatedAt_not_null | NOT NULL "CreatedAt" |
| Alerts_Id_not_null | NOT NULL "Id" |
| Alerts_IsRead_not_null | NOT NULL "IsRead" |
| Alerts_IsResolved_not_null | NOT NULL "IsResolved" |
| Alerts_OwnerId_not_null | NOT NULL "OwnerId" |
| Alerts_Severity_not_null | NOT NULL "Severity" |
| Alerts_Title_not_null | NOT NULL "Title" |
| Alerts_Type_not_null | NOT NULL "Type" |
| FK_Alerts_Users_ResolvedBy | FOREIGN KEY ("ResolvedBy") REFERENCES "Users"("Id") ON DELETE SET NULL |
| PK_Alerts | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_Alerts_CreatedAt | CREATE INDEX "IX_Alerts_CreatedAt" ON public."Alerts" USING btree ("CreatedAt") |
| IX_Alerts_IsRead | CREATE INDEX "IX_Alerts_IsRead" ON public."Alerts" USING btree ("IsRead") |
| IX_Alerts_IsResolved | CREATE INDEX "IX_Alerts_IsResolved" ON public."Alerts" USING btree ("IsResolved") |
| IX_Alerts_ResolvedBy | CREATE INDEX "IX_Alerts_ResolvedBy" ON public."Alerts" USING btree ("ResolvedBy") |
| IX_Alerts_Type | CREATE INDEX "IX_Alerts_Type" ON public."Alerts" USING btree ("Type") |
| PK_Alerts | CREATE UNIQUE INDEX "PK_Alerts" ON public."Alerts" USING btree ("Id") |

## AssistantDrafts

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | uuid | NO |  | NO |
| TenantId | integer | NO |  | NO |
| UserId | integer | NO |  | NO |
| Kind | varchar(40) | NO |  | NO |
| PayloadJson | text | NO |  | NO |
| PayloadHash | varchar(64) | NO |  | NO |
| Status | varchar(20) | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| ExpiresAt | timestamp with time zone | NO |  | NO |
| ConfirmedAt | timestamp with time zone | YES |  | NO |
| IdempotencyKey | varchar(80) | YES |  | NO |
| ResultJson | text | YES |  | NO |

| Constraint | Definition |
|---|---|
| AssistantDrafts_CreatedAt_not_null | NOT NULL "CreatedAt" |
| AssistantDrafts_ExpiresAt_not_null | NOT NULL "ExpiresAt" |
| AssistantDrafts_Id_not_null | NOT NULL "Id" |
| AssistantDrafts_Kind_not_null | NOT NULL "Kind" |
| AssistantDrafts_PayloadHash_not_null | NOT NULL "PayloadHash" |
| AssistantDrafts_PayloadJson_not_null | NOT NULL "PayloadJson" |
| AssistantDrafts_Status_not_null | NOT NULL "Status" |
| AssistantDrafts_TenantId_not_null | NOT NULL "TenantId" |
| AssistantDrafts_UserId_not_null | NOT NULL "UserId" |
| PK_AssistantDrafts | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_AssistantDrafts_TenantId_IdempotencyKey | CREATE UNIQUE INDEX "IX_AssistantDrafts_TenantId_IdempotencyKey" ON public."AssistantDrafts" USING btree ("TenantId", "IdempotencyKey") WHERE ("IdempotencyKey" IS NOT NULL) |
| IX_AssistantDrafts_TenantId_UserId_Status | CREATE INDEX "IX_AssistantDrafts_TenantId_UserId_Status" ON public."AssistantDrafts" USING btree ("TenantId", "UserId", "Status") |
| PK_AssistantDrafts | CREATE UNIQUE INDEX "PK_AssistantDrafts" ON public."AssistantDrafts" USING btree ("Id") |

## AuditLogs

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| OwnerId | integer | NO |  | NO |
| TenantId | integer | YES |  | NO |
| UserId | integer | NO |  | NO |
| Action | varchar(200) | NO |  | NO |
| EntityType | varchar(100) | YES |  | NO |
| EntityId | integer | YES |  | NO |
| OldValues | text | YES |  | NO |
| NewValues | text | YES |  | NO |
| IpAddress | varchar(45) | YES |  | NO |
| Details | text | YES |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |

| Constraint | Definition |
|---|---|
| AuditLogs_Action_not_null | NOT NULL "Action" |
| AuditLogs_CreatedAt_not_null | NOT NULL "CreatedAt" |
| AuditLogs_Id_not_null | NOT NULL "Id" |
| AuditLogs_OwnerId_not_null | NOT NULL "OwnerId" |
| AuditLogs_UserId_not_null | NOT NULL "UserId" |
| FK_AuditLogs_Users_UserId | FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE |
| PK_AuditLogs | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_AuditLogs_CreatedAt | CREATE INDEX "IX_AuditLogs_CreatedAt" ON public."AuditLogs" USING btree ("CreatedAt") |
| IX_AuditLogs_EntityType_EntityId | CREATE INDEX "IX_AuditLogs_EntityType_EntityId" ON public."AuditLogs" USING btree ("EntityType", "EntityId") |
| IX_AuditLogs_TenantId | CREATE INDEX "IX_AuditLogs_TenantId" ON public."AuditLogs" USING btree ("TenantId") |
| IX_AuditLogs_UserId | CREATE INDEX "IX_AuditLogs_UserId" ON public."AuditLogs" USING btree ("UserId") |
| PK_AuditLogs | CREATE UNIQUE INDEX "PK_AuditLogs" ON public."AuditLogs" USING btree ("Id") |

## BackupDeviceSchedules

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| TenantId | integer | NO |  | NO |
| DeviceId | integer | NO |  | NO |
| Enabled | boolean | NO |  | NO |
| Frequency | varchar(16) | NO |  | NO |
| LocalTime | varchar(5) | NO |  | NO |
| TimeZoneId | varchar(80) | NO |  | NO |
| WeeklyDay | integer | NO |  | NO |
| IncludeInvoicePdfs | boolean | NO |  | NO |
| RetentionCount | integer | NO |  | NO |
| UpdatedAt | timestamp with time zone | NO |  | NO |

| Constraint | Definition |
|---|---|
| BackupDeviceSchedules_DeviceId_not_null | NOT NULL "DeviceId" |
| BackupDeviceSchedules_Enabled_not_null | NOT NULL "Enabled" |
| BackupDeviceSchedules_Frequency_not_null | NOT NULL "Frequency" |
| BackupDeviceSchedules_Id_not_null | NOT NULL "Id" |
| BackupDeviceSchedules_IncludeInvoicePdfs_not_null | NOT NULL "IncludeInvoicePdfs" |
| BackupDeviceSchedules_LocalTime_not_null | NOT NULL "LocalTime" |
| BackupDeviceSchedules_RetentionCount_not_null | NOT NULL "RetentionCount" |
| BackupDeviceSchedules_TenantId_not_null | NOT NULL "TenantId" |
| BackupDeviceSchedules_TimeZoneId_not_null | NOT NULL "TimeZoneId" |
| BackupDeviceSchedules_UpdatedAt_not_null | NOT NULL "UpdatedAt" |
| BackupDeviceSchedules_WeeklyDay_not_null | NOT NULL "WeeklyDay" |
| FK_BackupDeviceSchedules_BackupDevices_DeviceId | FOREIGN KEY ("DeviceId") REFERENCES "BackupDevices"("Id") ON DELETE CASCADE |
| FK_BackupDeviceSchedules_Tenants_TenantId | FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE RESTRICT |
| PK_BackupDeviceSchedules | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_BackupDeviceSchedules_DeviceId | CREATE UNIQUE INDEX "IX_BackupDeviceSchedules_DeviceId" ON public."BackupDeviceSchedules" USING btree ("DeviceId") |
| IX_BackupDeviceSchedules_TenantId | CREATE INDEX "IX_BackupDeviceSchedules_TenantId" ON public."BackupDeviceSchedules" USING btree ("TenantId") |
| PK_BackupDeviceSchedules | CREATE UNIQUE INDEX "PK_BackupDeviceSchedules" ON public."BackupDeviceSchedules" USING btree ("Id") |

## BackupDeviceTokens

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| TenantId | integer | NO |  | NO |
| DeviceId | integer | NO |  | NO |
| TokenHash | varchar(64) | NO |  | NO |
| ExpiresAt | timestamp with time zone | NO |  | NO |
| RevokedAt | timestamp with time zone | YES |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |

| Constraint | Definition |
|---|---|
| BackupDeviceTokens_CreatedAt_not_null | NOT NULL "CreatedAt" |
| BackupDeviceTokens_DeviceId_not_null | NOT NULL "DeviceId" |
| BackupDeviceTokens_ExpiresAt_not_null | NOT NULL "ExpiresAt" |
| BackupDeviceTokens_Id_not_null | NOT NULL "Id" |
| BackupDeviceTokens_TenantId_not_null | NOT NULL "TenantId" |
| BackupDeviceTokens_TokenHash_not_null | NOT NULL "TokenHash" |
| FK_BackupDeviceTokens_BackupDevices_DeviceId | FOREIGN KEY ("DeviceId") REFERENCES "BackupDevices"("Id") ON DELETE CASCADE |
| FK_BackupDeviceTokens_Tenants_TenantId | FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE RESTRICT |
| PK_BackupDeviceTokens | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_BackupDeviceTokens_DeviceId | CREATE INDEX "IX_BackupDeviceTokens_DeviceId" ON public."BackupDeviceTokens" USING btree ("DeviceId") |
| IX_BackupDeviceTokens_TokenHash | CREATE UNIQUE INDEX "IX_BackupDeviceTokens_TokenHash" ON public."BackupDeviceTokens" USING btree ("TokenHash") |
| PK_BackupDeviceTokens | CREATE UNIQUE INDEX "PK_BackupDeviceTokens" ON public."BackupDeviceTokens" USING btree ("Id") |

## BackupDevices

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| TenantId | integer | NO |  | NO |
| CreatedByUserId | integer | NO |  | NO |
| DisplayName | varchar(80) | NO |  | NO |
| FolderLabel | varchar(120) | YES |  | NO |
| LastSeenAt | timestamp with time zone | YES |  | NO |
| RevokedAt | timestamp with time zone | YES |  | NO |
| AgentVersion | varchar(40) | YES |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |

| Constraint | Definition |
|---|---|
| BackupDevices_CreatedAt_not_null | NOT NULL "CreatedAt" |
| BackupDevices_CreatedByUserId_not_null | NOT NULL "CreatedByUserId" |
| BackupDevices_DisplayName_not_null | NOT NULL "DisplayName" |
| BackupDevices_Id_not_null | NOT NULL "Id" |
| BackupDevices_TenantId_not_null | NOT NULL "TenantId" |
| FK_BackupDevices_Tenants_TenantId | FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE RESTRICT |
| FK_BackupDevices_Users_CreatedByUserId | FOREIGN KEY ("CreatedByUserId") REFERENCES "Users"("Id") ON DELETE RESTRICT |
| PK_BackupDevices | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_BackupDevices_CreatedByUserId | CREATE INDEX "IX_BackupDevices_CreatedByUserId" ON public."BackupDevices" USING btree ("CreatedByUserId") |
| IX_BackupDevices_TenantId | CREATE INDEX "IX_BackupDevices_TenantId" ON public."BackupDevices" USING btree ("TenantId") |
| PK_BackupDevices | CREATE UNIQUE INDEX "PK_BackupDevices" ON public."BackupDevices" USING btree ("Id") |

## BackupPairingCodes

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| TenantId | integer | NO |  | NO |
| CreatedByUserId | integer | NO |  | NO |
| CodeHash | varchar(64) | NO |  | NO |
| ExpiresAt | timestamp with time zone | NO |  | NO |
| ConsumedAt | timestamp with time zone | YES |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |

| Constraint | Definition |
|---|---|
| BackupPairingCodes_CodeHash_not_null | NOT NULL "CodeHash" |
| BackupPairingCodes_CreatedAt_not_null | NOT NULL "CreatedAt" |
| BackupPairingCodes_CreatedByUserId_not_null | NOT NULL "CreatedByUserId" |
| BackupPairingCodes_ExpiresAt_not_null | NOT NULL "ExpiresAt" |
| BackupPairingCodes_Id_not_null | NOT NULL "Id" |
| BackupPairingCodes_TenantId_not_null | NOT NULL "TenantId" |
| FK_BackupPairingCodes_Tenants_TenantId | FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE RESTRICT |
| FK_BackupPairingCodes_Users_CreatedByUserId | FOREIGN KEY ("CreatedByUserId") REFERENCES "Users"("Id") ON DELETE RESTRICT |
| PK_BackupPairingCodes | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_BackupPairingCodes_CodeHash | CREATE UNIQUE INDEX "IX_BackupPairingCodes_CodeHash" ON public."BackupPairingCodes" USING btree ("CodeHash") |
| IX_BackupPairingCodes_CreatedByUserId | CREATE INDEX "IX_BackupPairingCodes_CreatedByUserId" ON public."BackupPairingCodes" USING btree ("CreatedByUserId") |
| IX_BackupPairingCodes_TenantId | CREATE INDEX "IX_BackupPairingCodes_TenantId" ON public."BackupPairingCodes" USING btree ("TenantId") |
| PK_BackupPairingCodes | CREATE UNIQUE INDEX "PK_BackupPairingCodes" ON public."BackupPairingCodes" USING btree ("Id") |

## BackupRuns

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| TenantId | integer | NO |  | NO |
| DeviceId | integer | NO |  | NO |
| SlotKey | varchar(16) | NO |  | NO |
| Status | varchar(20) | NO |  | NO |
| SizeBytes | bigint | YES |  | NO |
| Sha256 | varchar(64) | YES |  | NO |
| Verified | boolean | NO |  | NO |
| MissedCatchUp | boolean | NO |  | NO |
| FailureReason | varchar(200) | YES |  | NO |
| FileName | varchar(180) | YES |  | NO |
| DownloadName | varchar(180) | YES |  | NO |
| StartedAt | timestamp with time zone | NO |  | NO |
| CompletedAt | timestamp with time zone | YES |  | NO |

| Constraint | Definition |
|---|---|
| BackupRuns_DeviceId_not_null | NOT NULL "DeviceId" |
| BackupRuns_Id_not_null | NOT NULL "Id" |
| BackupRuns_MissedCatchUp_not_null | NOT NULL "MissedCatchUp" |
| BackupRuns_SlotKey_not_null | NOT NULL "SlotKey" |
| BackupRuns_StartedAt_not_null | NOT NULL "StartedAt" |
| BackupRuns_Status_not_null | NOT NULL "Status" |
| BackupRuns_TenantId_not_null | NOT NULL "TenantId" |
| BackupRuns_Verified_not_null | NOT NULL "Verified" |
| FK_BackupRuns_BackupDevices_DeviceId | FOREIGN KEY ("DeviceId") REFERENCES "BackupDevices"("Id") ON DELETE CASCADE |
| FK_BackupRuns_Tenants_TenantId | FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE RESTRICT |
| PK_BackupRuns | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_BackupRuns_DeviceId_SlotKey | CREATE UNIQUE INDEX "IX_BackupRuns_DeviceId_SlotKey" ON public."BackupRuns" USING btree ("DeviceId", "SlotKey") |
| IX_BackupRuns_TenantId | CREATE INDEX "IX_BackupRuns_TenantId" ON public."BackupRuns" USING btree ("TenantId") |
| PK_BackupRuns | CREATE UNIQUE INDEX "PK_BackupRuns" ON public."BackupRuns" USING btree ("Id") |

## BranchStaff

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO | nextval('"BranchStaff_Id_seq"'::regclass) | NO |
| BranchId | integer | NO |  | NO |
| UserId | integer | NO |  | NO |
| AssignedAt | timestamp with time zone | NO |  | NO |

| Constraint | Definition |
|---|---|
| BranchStaff_AssignedAt_not_null | NOT NULL "AssignedAt" |
| BranchStaff_BranchId_not_null | NOT NULL "BranchId" |
| BranchStaff_Id_not_null | NOT NULL "Id" |
| BranchStaff_UserId_not_null | NOT NULL "UserId" |
| FK_BranchStaff_Branches_BranchId | FOREIGN KEY ("BranchId") REFERENCES "Branches"("Id") ON DELETE CASCADE |
| FK_BranchStaff_Users_UserId | FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE |
| PK_BranchStaff | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_BranchStaff_BranchId | CREATE INDEX "IX_BranchStaff_BranchId" ON public."BranchStaff" USING btree ("BranchId") |
| IX_BranchStaff_BranchId_UserId | CREATE UNIQUE INDEX "IX_BranchStaff_BranchId_UserId" ON public."BranchStaff" USING btree ("BranchId", "UserId") |
| IX_BranchStaff_UserId | CREATE INDEX "IX_BranchStaff_UserId" ON public."BranchStaff" USING btree ("UserId") |
| PK_BranchStaff | CREATE UNIQUE INDEX "PK_BranchStaff" ON public."BranchStaff" USING btree ("Id") |

## Branches

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| TenantId | integer | NO |  | NO |
| Name | varchar(200) | NO |  | NO |
| Address | varchar(500) | YES |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| UpdatedAt | timestamp with time zone | YES |  | NO |
| IsActive | boolean | NO | true | NO |
| Location | varchar(200) | YES |  | NO |
| ManagerUserId | integer | YES |  | NO |
| ManagerId | integer | YES |  | NO |
| ManagerId1 | integer | YES |  | NO |

| Constraint | Definition |
|---|---|
| Branches_CreatedAt_not_null | NOT NULL "CreatedAt" |
| Branches_Id_not_null | NOT NULL "Id" |
| Branches_IsActive_not_null | NOT NULL "IsActive" |
| Branches_Name_not_null | NOT NULL "Name" |
| Branches_TenantId_not_null | NOT NULL "TenantId" |
| Branches_pkey | PRIMARY KEY ("Id") |
| FK_Branches_Tenants_TenantId | FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE CASCADE |

| Index | Definition |
|---|---|
| Branches_pkey | CREATE UNIQUE INDEX "Branches_pkey" ON public."Branches" USING btree ("Id") |
| IX_Branches_TenantId | CREATE INDEX "IX_Branches_TenantId" ON public."Branches" USING btree ("TenantId") |

## CashDrawerMovements

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| TenantId | integer | NO |  | NO |
| OwnerId | integer | NO |  | NO |
| BranchId | integer | YES |  | NO |
| MovementDate | timestamp with time zone | NO |  | NO |
| Kind | integer | NO |  | NO |
| Amount | numeric(18,2) | NO |  | NO |
| Note | varchar(500) | YES |  | NO |
| CreatedByUserId | integer | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |

| Constraint | Definition |
|---|---|
| CashDrawerMovements_Amount_not_null | NOT NULL "Amount" |
| CashDrawerMovements_CreatedAt_not_null | NOT NULL "CreatedAt" |
| CashDrawerMovements_CreatedByUserId_not_null | NOT NULL "CreatedByUserId" |
| CashDrawerMovements_Id_not_null | NOT NULL "Id" |
| CashDrawerMovements_Kind_not_null | NOT NULL "Kind" |
| CashDrawerMovements_MovementDate_not_null | NOT NULL "MovementDate" |
| CashDrawerMovements_OwnerId_not_null | NOT NULL "OwnerId" |
| CashDrawerMovements_TenantId_not_null | NOT NULL "TenantId" |
| CashDrawerMovements_pkey | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| CashDrawerMovements_pkey | CREATE UNIQUE INDEX "CashDrawerMovements_pkey" ON public."CashDrawerMovements" USING btree ("Id") |
| IX_CashDrawerMovements_TenantId_MovementDate | CREATE INDEX "IX_CashDrawerMovements_TenantId_MovementDate" ON public."CashDrawerMovements" USING btree ("TenantId", "MovementDate") |

## CreditNotes

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO | nextval('"CreditNotes_Id_seq"'::regclass) | NO |
| TenantId | integer | NO |  | NO |
| CustomerId | integer | NO |  | NO |
| LinkedReturnId | integer | NO |  | NO |
| Amount | numeric(18,2) | NO |  | NO |
| Currency | varchar(10) | NO |  | NO |
| Status | varchar(20) | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| CreatedBy | integer | NO |  | NO |
| AppliedAmount | numeric(18,2) | NO | 0 | NO |

| Constraint | Definition |
|---|---|
| CreditNotes_Amount_not_null | NOT NULL "Amount" |
| CreditNotes_AppliedAmount_not_null | NOT NULL "AppliedAmount" |
| CreditNotes_CreatedAt_not_null | NOT NULL "CreatedAt" |
| CreditNotes_CreatedBy_not_null | NOT NULL "CreatedBy" |
| CreditNotes_Currency_not_null | NOT NULL "Currency" |
| CreditNotes_CustomerId_not_null | NOT NULL "CustomerId" |
| CreditNotes_Id_not_null | NOT NULL "Id" |
| CreditNotes_LinkedReturnId_not_null | NOT NULL "LinkedReturnId" |
| CreditNotes_Status_not_null | NOT NULL "Status" |
| CreditNotes_TenantId_not_null | NOT NULL "TenantId" |
| CreditNotes_pkey | PRIMARY KEY ("Id") |
| FK_CreditNotes_Customers_CustomerId | FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE CASCADE |
| FK_CreditNotes_SaleReturns_LinkedReturnId | FOREIGN KEY ("LinkedReturnId") REFERENCES "SaleReturns"("Id") ON DELETE CASCADE |
| FK_CreditNotes_Tenants_TenantId | FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE CASCADE |
| FK_CreditNotes_Users_CreatedBy | FOREIGN KEY ("CreatedBy") REFERENCES "Users"("Id") |

| Index | Definition |
|---|---|
| CreditNotes_pkey | CREATE UNIQUE INDEX "CreditNotes_pkey" ON public."CreditNotes" USING btree ("Id") |
| IX_CreditNotes_CustomerId | CREATE INDEX "IX_CreditNotes_CustomerId" ON public."CreditNotes" USING btree ("CustomerId") |
| IX_CreditNotes_LinkedReturnId | CREATE INDEX "IX_CreditNotes_LinkedReturnId" ON public."CreditNotes" USING btree ("LinkedReturnId") |
| IX_CreditNotes_TenantId | CREATE INDEX "IX_CreditNotes_TenantId" ON public."CreditNotes" USING btree ("TenantId") |

## CustomerItemPrices

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| TenantId | integer | NO |  | NO |
| CustomerId | integer | NO |  | NO |
| ProductId | integer | NO |  | NO |
| LastUnitPrice | numeric(18,2) | NO |  | NO |
| LastSaleId | integer | YES |  | NO |
| LastSaleDate | timestamp with time zone | NO |  | NO |
| UpdatedAt | timestamp with time zone | NO |  | NO |

| Constraint | Definition |
|---|---|
| CustomerItemPrices_CustomerId_not_null | NOT NULL "CustomerId" |
| CustomerItemPrices_Id_not_null | NOT NULL "Id" |
| CustomerItemPrices_LastSaleDate_not_null | NOT NULL "LastSaleDate" |
| CustomerItemPrices_LastUnitPrice_not_null | NOT NULL "LastUnitPrice" |
| CustomerItemPrices_ProductId_not_null | NOT NULL "ProductId" |
| CustomerItemPrices_TenantId_not_null | NOT NULL "TenantId" |
| CustomerItemPrices_UpdatedAt_not_null | NOT NULL "UpdatedAt" |
| CustomerItemPrices_pkey | PRIMARY KEY ("Id") |
| FK_CustomerItemPrices_Customers_CustomerId | FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE CASCADE |
| FK_CustomerItemPrices_Products_ProductId | FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE RESTRICT |
| FK_CustomerItemPrices_Sales_LastSaleId | FOREIGN KEY ("LastSaleId") REFERENCES "Sales"("Id") ON DELETE SET NULL |

| Index | Definition |
|---|---|
| CustomerItemPrices_pkey | CREATE UNIQUE INDEX "CustomerItemPrices_pkey" ON public."CustomerItemPrices" USING btree ("Id") |
| IX_CustomerItemPrices_CustomerId | CREATE INDEX "IX_CustomerItemPrices_CustomerId" ON public."CustomerItemPrices" USING btree ("CustomerId") |
| IX_CustomerItemPrices_LastSaleId | CREATE INDEX "IX_CustomerItemPrices_LastSaleId" ON public."CustomerItemPrices" USING btree ("LastSaleId") |
| IX_CustomerItemPrices_ProductId | CREATE INDEX "IX_CustomerItemPrices_ProductId" ON public."CustomerItemPrices" USING btree ("ProductId") |
| IX_CustomerItemPrices_TenantId_CustomerId_ProductId | CREATE UNIQUE INDEX "IX_CustomerItemPrices_TenantId_CustomerId_ProductId" ON public."CustomerItemPrices" USING btree ("TenantId", "CustomerId", "ProductId") |

## CustomerVisits

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO | nextval('"CustomerVisits_Id_seq"'::regclass) | NO |
| RouteId | integer | NO |  | NO |
| CustomerId | integer | NO |  | NO |
| TenantId | integer | NO |  | NO |
| StaffId | integer | YES |  | NO |
| VisitDate | timestamp with time zone | NO |  | NO |
| Status | varchar(50) | NO | 'NotVisited'::character varying | NO |
| Notes | varchar(500) | YES |  | NO |
| PaymentCollected | numeric(18,2) | YES |  | NO |
| CreatedAt | timestamp with time zone | NO | (now() AT TIME ZONE 'utc'::text) | NO |
| UpdatedAt | timestamp with time zone | YES |  | NO |
| Latitude | numeric(9,6) | YES |  | NO |
| Longitude | numeric(9,6) | YES |  | NO |
| ReachedAt | timestamp with time zone | YES |  | NO |

| Constraint | Definition |
|---|---|
| CustomerVisits_CreatedAt_not_null | NOT NULL "CreatedAt" |
| CustomerVisits_CustomerId_not_null | NOT NULL "CustomerId" |
| CustomerVisits_Id_not_null | NOT NULL "Id" |
| CustomerVisits_RouteId_not_null | NOT NULL "RouteId" |
| CustomerVisits_Status_not_null | NOT NULL "Status" |
| CustomerVisits_TenantId_not_null | NOT NULL "TenantId" |
| CustomerVisits_VisitDate_not_null | NOT NULL "VisitDate" |
| CustomerVisits_pkey | PRIMARY KEY ("Id") |
| FK_CustomerVisits_Customers_CustomerId | FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE CASCADE |
| FK_CustomerVisits_Routes_RouteId | FOREIGN KEY ("RouteId") REFERENCES "Routes"("Id") ON DELETE CASCADE |
| FK_CustomerVisits_Tenants_TenantId | FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE CASCADE |
| FK_CustomerVisits_Users_StaffId | FOREIGN KEY ("StaffId") REFERENCES "Users"("Id") ON DELETE SET NULL |

| Index | Definition |
|---|---|
| CustomerVisits_pkey | CREATE UNIQUE INDEX "CustomerVisits_pkey" ON public."CustomerVisits" USING btree ("Id") |
| IX_CustomerVisits_RouteId_CustomerId_VisitDate | CREATE UNIQUE INDEX "IX_CustomerVisits_RouteId_CustomerId_VisitDate" ON public."CustomerVisits" USING btree ("RouteId", "CustomerId", "VisitDate") |
| IX_CustomerVisits_TenantId | CREATE INDEX "IX_CustomerVisits_TenantId" ON public."CustomerVisits" USING btree ("TenantId") |
| IX_CustomerVisits_TenantId_CustomerId_VisitDate | CREATE INDEX "IX_CustomerVisits_TenantId_CustomerId_VisitDate" ON public."CustomerVisits" USING btree ("TenantId", "CustomerId", "VisitDate" DESC) |
| IX_CustomerVisits_VisitDate | CREATE INDEX "IX_CustomerVisits_VisitDate" ON public."CustomerVisits" USING btree ("VisitDate") |

## Customers

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| OwnerId | integer | NO |  | NO |
| TenantId | integer | YES |  | NO |
| Name | varchar(200) | NO |  | NO |
| CustomerType | integer | NO |  | NO |
| Phone | varchar(20) | YES |  | NO |
| Email | varchar(100) | YES |  | NO |
| Trn | varchar(50) | YES |  | NO |
| Address | varchar(500) | YES |  | NO |
| CreditLimit | numeric(18,2) | NO | 0.0 | NO |
| TotalSales | numeric(18,2) | NO | 0.0 | NO |
| TotalPayments | numeric(18,2) | NO | 0.0 | NO |
| PendingBalance | numeric(18,2) | NO | 0.0 | NO |
| Balance | numeric(18,2) | NO | 0.0 | NO |
| LastActivity | timestamp with time zone | YES |  | NO |
| LastPaymentDate | timestamp with time zone | YES |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| UpdatedAt | timestamp with time zone | NO |  | NO |
| RowVersion | bytea | YES | '\x00'::bytea | NO |
| PaymentTerms | varchar(100) | YES |  | NO |
| BranchId | integer | YES |  | NO |
| RouteId | integer | YES |  | NO |
| Location | varchar(200) | YES |  | NO |
| MainLatitude | numeric(9,6) | YES |  | NO |
| MainLongitude | numeric(9,6) | YES |  | NO |
| LocationUpdatedAt | timestamp with time zone | YES |  | NO |
| LocationUpdatedBy | integer | YES |  | NO |

| Constraint | Definition |
|---|---|
| Customers_Balance_not_null | NOT NULL "Balance" |
| Customers_CreatedAt_not_null | NOT NULL "CreatedAt" |
| Customers_CreditLimit_not_null | NOT NULL "CreditLimit" |
| Customers_CustomerType_not_null | NOT NULL "CustomerType" |
| Customers_Id_not_null | NOT NULL "Id" |
| Customers_Name_not_null | NOT NULL "Name" |
| Customers_OwnerId_not_null | NOT NULL "OwnerId" |
| Customers_PendingBalance_not_null | NOT NULL "PendingBalance" |
| Customers_TotalPayments_not_null | NOT NULL "TotalPayments" |
| Customers_TotalSales_not_null | NOT NULL "TotalSales" |
| Customers_UpdatedAt_not_null | NOT NULL "UpdatedAt" |
| PK_Customers | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_Customers_TenantId_HasMainPin | CREATE INDEX "IX_Customers_TenantId_HasMainPin" ON public."Customers" USING btree ("TenantId") WHERE ("MainLatitude" IS NOT NULL) |
| IX_Customers_TenantId_RouteId | CREATE INDEX "IX_Customers_TenantId_RouteId" ON public."Customers" USING btree ("TenantId", "RouteId") WHERE ("RouteId" IS NOT NULL) |
| PK_Customers | CREATE UNIQUE INDEX "PK_Customers" ON public."Customers" USING btree ("Id") |
| idx_customers_tenant_name | CREATE INDEX idx_customers_tenant_name ON public."Customers" USING btree ("TenantId", "Name") |
| idx_customers_tenantid | CREATE INDEX idx_customers_tenantid ON public."Customers" USING btree ("TenantId") |

## DailyCashCloses

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| TenantId | integer | NO |  | NO |
| OwnerId | integer | NO |  | NO |
| BranchId | integer | YES |  | NO |
| BusinessDate | timestamp with time zone | NO |  | NO |
| Version | integer | NO |  | NO |
| Status | text | NO |  | NO |
| OpeningCash | numeric(18,2) | NO |  | NO |
| CashReceived | numeric(18,2) | NO |  | NO |
| CashPaidOut | numeric(18,2) | NO |  | NO |
| ExpectedCash | numeric(18,2) | NO |  | NO |
| CountedCash | numeric(18,2) | NO |  | NO |
| Variance | numeric(18,2) | NO |  | NO |
| VarianceReason | varchar(500) | YES |  | NO |
| Comment | varchar(1000) | YES |  | NO |
| ClosedAt | timestamp with time zone | YES |  | NO |
| ClosedByUserId | integer | YES |  | NO |
| ReopenedAt | timestamp with time zone | YES |  | NO |
| ReopenReason | varchar(500) | YES |  | NO |
| CreatedByUserId | integer | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| UpdatedAt | timestamp with time zone | NO |  | NO |
| BankPaidOut | numeric(18,2) | NO | 0 | NO |
| BankReceived | numeric(18,2) | NO | 0 | NO |

| Constraint | Definition |
|---|---|
| DailyCashCloses_BankPaidOut_not_null | NOT NULL "BankPaidOut" |
| DailyCashCloses_BankReceived_not_null | NOT NULL "BankReceived" |
| DailyCashCloses_BusinessDate_not_null | NOT NULL "BusinessDate" |
| DailyCashCloses_CashPaidOut_not_null | NOT NULL "CashPaidOut" |
| DailyCashCloses_CashReceived_not_null | NOT NULL "CashReceived" |
| DailyCashCloses_CountedCash_not_null | NOT NULL "CountedCash" |
| DailyCashCloses_CreatedAt_not_null | NOT NULL "CreatedAt" |
| DailyCashCloses_CreatedByUserId_not_null | NOT NULL "CreatedByUserId" |
| DailyCashCloses_ExpectedCash_not_null | NOT NULL "ExpectedCash" |
| DailyCashCloses_Id_not_null | NOT NULL "Id" |
| DailyCashCloses_OpeningCash_not_null | NOT NULL "OpeningCash" |
| DailyCashCloses_OwnerId_not_null | NOT NULL "OwnerId" |
| DailyCashCloses_Status_not_null | NOT NULL "Status" |
| DailyCashCloses_TenantId_not_null | NOT NULL "TenantId" |
| DailyCashCloses_UpdatedAt_not_null | NOT NULL "UpdatedAt" |
| DailyCashCloses_Variance_not_null | NOT NULL "Variance" |
| DailyCashCloses_Version_not_null | NOT NULL "Version" |
| DailyCashCloses_pkey | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| DailyCashCloses_pkey | CREATE UNIQUE INDEX "DailyCashCloses_pkey" ON public."DailyCashCloses" USING btree ("Id") |
| IX_DailyCashCloses_TenantId_BusinessDate_BranchId_Version | CREATE UNIQUE INDEX "IX_DailyCashCloses_TenantId_BusinessDate_BranchId_Version" ON public."DailyCashCloses" USING btree ("TenantId", "BusinessDate", "BranchId", "Version") |

## DamageCategories

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO | nextval('"DamageCategories_Id_seq"'::regclass) | NO |
| TenantId | integer | NO |  | NO |
| Name | varchar(100) | NO |  | NO |
| AffectsStock | boolean | NO | true | NO |
| AffectsLedger | boolean | NO | true | NO |
| IsResaleable | boolean | NO | true | NO |
| SortOrder | integer | NO | 0 | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |

| Constraint | Definition |
|---|---|
| DamageCategories_AffectsLedger_not_null | NOT NULL "AffectsLedger" |
| DamageCategories_AffectsStock_not_null | NOT NULL "AffectsStock" |
| DamageCategories_CreatedAt_not_null | NOT NULL "CreatedAt" |
| DamageCategories_Id_not_null | NOT NULL "Id" |
| DamageCategories_IsResaleable_not_null | NOT NULL "IsResaleable" |
| DamageCategories_Name_not_null | NOT NULL "Name" |
| DamageCategories_SortOrder_not_null | NOT NULL "SortOrder" |
| DamageCategories_TenantId_not_null | NOT NULL "TenantId" |
| DamageCategories_pkey | PRIMARY KEY ("Id") |
| FK_DamageCategories_Tenants_TenantId | FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE CASCADE |

| Index | Definition |
|---|---|
| DamageCategories_pkey | CREATE UNIQUE INDEX "DamageCategories_pkey" ON public."DamageCategories" USING btree ("Id") |
| IX_DamageCategories_TenantId | CREATE INDEX "IX_DamageCategories_TenantId" ON public."DamageCategories" USING btree ("TenantId") |

## DamageInventories

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO | nextval('"DamageInventories_Id_seq"'::regclass) | NO |
| TenantId | integer | NO |  | NO |
| ProductId | integer | NO |  | NO |
| BranchId | integer | YES |  | NO |
| Quantity | numeric(18,2) | NO | 0 | NO |
| SourceReturnId | integer | YES |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| UpdatedAt | timestamp with time zone | NO |  | NO |

| Constraint | Definition |
|---|---|
| DamageInventories_CreatedAt_not_null | NOT NULL "CreatedAt" |
| DamageInventories_Id_not_null | NOT NULL "Id" |
| DamageInventories_ProductId_not_null | NOT NULL "ProductId" |
| DamageInventories_Quantity_not_null | NOT NULL "Quantity" |
| DamageInventories_TenantId_not_null | NOT NULL "TenantId" |
| DamageInventories_UpdatedAt_not_null | NOT NULL "UpdatedAt" |
| DamageInventories_pkey | PRIMARY KEY ("Id") |
| FK_DamageInventories_Branches_BranchId | FOREIGN KEY ("BranchId") REFERENCES "Branches"("Id") |
| FK_DamageInventories_Products_ProductId | FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE |
| FK_DamageInventories_SaleReturns_SourceReturnId | FOREIGN KEY ("SourceReturnId") REFERENCES "SaleReturns"("Id") |
| FK_DamageInventories_Tenants_TenantId | FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE CASCADE |

| Index | Definition |
|---|---|
| DamageInventories_pkey | CREATE UNIQUE INDEX "DamageInventories_pkey" ON public."DamageInventories" USING btree ("Id") |
| IX_DamageInventories_TenantId_ProductId_BranchId | CREATE INDEX "IX_DamageInventories_TenantId_ProductId_BranchId" ON public."DamageInventories" USING btree ("TenantId", "ProductId", "BranchId") |

## DemoRequests

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| CompanyName | varchar(200) | NO |  | NO |
| ContactName | varchar(100) | NO |  | NO |
| WhatsApp | varchar(20) | NO |  | NO |
| Email | varchar(100) | NO |  | NO |
| Country | varchar(10) | NO |  | NO |
| Industry | varchar(100) | NO |  | NO |
| MonthlySalesRange | varchar(50) | NO |  | NO |
| StaffCount | integer | NO |  | NO |
| Status | text | NO |  | NO |
| RejectionReason | varchar(500) | YES |  | NO |
| AssignedPlanId | integer | YES |  | NO |
| CreatedTenantId | integer | YES |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| ProcessedAt | timestamp with time zone | YES |  | NO |
| ProcessedByUserId | integer | YES |  | NO |

| Constraint | Definition |
|---|---|
| DemoRequests_CompanyName_not_null | NOT NULL "CompanyName" |
| DemoRequests_ContactName_not_null | NOT NULL "ContactName" |
| DemoRequests_Country_not_null | NOT NULL "Country" |
| DemoRequests_CreatedAt_not_null | NOT NULL "CreatedAt" |
| DemoRequests_Email_not_null | NOT NULL "Email" |
| DemoRequests_Id_not_null | NOT NULL "Id" |
| DemoRequests_Industry_not_null | NOT NULL "Industry" |
| DemoRequests_MonthlySalesRange_not_null | NOT NULL "MonthlySalesRange" |
| DemoRequests_StaffCount_not_null | NOT NULL "StaffCount" |
| DemoRequests_Status_not_null | NOT NULL "Status" |
| DemoRequests_WhatsApp_not_null | NOT NULL "WhatsApp" |
| PK_DemoRequests | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_DemoRequests_CreatedAt | CREATE INDEX "IX_DemoRequests_CreatedAt" ON public."DemoRequests" USING btree ("CreatedAt") |
| IX_DemoRequests_Email | CREATE INDEX "IX_DemoRequests_Email" ON public."DemoRequests" USING btree ("Email") |
| IX_DemoRequests_Status | CREATE INDEX "IX_DemoRequests_Status" ON public."DemoRequests" USING btree ("Status") |
| PK_DemoRequests | CREATE UNIQUE INDEX "PK_DemoRequests" ON public."DemoRequests" USING btree ("Id") |

## ErrorLogs

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| TraceId | varchar(64) | NO |  | NO |
| ErrorCode | varchar(64) | NO |  | NO |
| Message | varchar(2000) | NO |  | NO |
| StackTrace | text | YES |  | NO |
| Path | varchar(500) | YES |  | NO |
| Method | varchar(16) | YES |  | NO |
| TenantId | integer | YES |  | NO |
| UserId | integer | YES |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| ResolvedAt | timestamp with time zone | YES |  | NO |

| Constraint | Definition |
|---|---|
| ErrorLogs_CreatedAt_not_null | NOT NULL "CreatedAt" |
| ErrorLogs_ErrorCode_not_null | NOT NULL "ErrorCode" |
| ErrorLogs_Id_not_null | NOT NULL "Id" |
| ErrorLogs_Message_not_null | NOT NULL "Message" |
| ErrorLogs_TraceId_not_null | NOT NULL "TraceId" |
| PK_ErrorLogs | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_ErrorLogs_CreatedAt | CREATE INDEX "IX_ErrorLogs_CreatedAt" ON public."ErrorLogs" USING btree ("CreatedAt") |
| IX_ErrorLogs_ErrorCode | CREATE INDEX "IX_ErrorLogs_ErrorCode" ON public."ErrorLogs" USING btree ("ErrorCode") |
| IX_ErrorLogs_ResolvedAt | CREATE INDEX "IX_ErrorLogs_ResolvedAt" ON public."ErrorLogs" USING btree ("ResolvedAt") |
| IX_ErrorLogs_TenantId | CREATE INDEX "IX_ErrorLogs_TenantId" ON public."ErrorLogs" USING btree ("TenantId") |
| PK_ErrorLogs | CREATE UNIQUE INDEX "PK_ErrorLogs" ON public."ErrorLogs" USING btree ("Id") |

## ExpenseCategories

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| Name | varchar(100) | NO |  | NO |
| ColorCode | varchar(7) | NO |  | NO |
| IsActive | boolean | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| TenantId | integer | YES |  | NO |
| DefaultVatRate | numeric(5,4) | NO | 0.0 | NO |
| DefaultTaxType | varchar(20) | NO | 'Standard'::character varying | NO |
| DefaultIsTaxClaimable | boolean | NO | false | NO |
| DefaultIsEntertainment | boolean | NO | false | NO |
| VatDefaultLocked | boolean | NO | false | NO |

| Constraint | Definition |
|---|---|
| ExpenseCategories_ColorCode_not_null | NOT NULL "ColorCode" |
| ExpenseCategories_CreatedAt_not_null | NOT NULL "CreatedAt" |
| ExpenseCategories_DefaultIsEntertainment_not_null | NOT NULL "DefaultIsEntertainment" |
| ExpenseCategories_DefaultIsTaxClaimable_not_null | NOT NULL "DefaultIsTaxClaimable" |
| ExpenseCategories_DefaultTaxType_not_null | NOT NULL "DefaultTaxType" |
| ExpenseCategories_DefaultVatRate_not_null | NOT NULL "DefaultVatRate" |
| ExpenseCategories_Id_not_null | NOT NULL "Id" |
| ExpenseCategories_IsActive_not_null | NOT NULL "IsActive" |
| ExpenseCategories_Name_not_null | NOT NULL "Name" |
| ExpenseCategories_VatDefaultLocked_not_null | NOT NULL "VatDefaultLocked" |
| PK_ExpenseCategories | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_ExpenseCategories_TenantId_Name | CREATE UNIQUE INDEX "IX_ExpenseCategories_TenantId_Name" ON public."ExpenseCategories" USING btree ("TenantId", "Name") |
| PK_ExpenseCategories | CREATE UNIQUE INDEX "PK_ExpenseCategories" ON public."ExpenseCategories" USING btree ("Id") |

## Expenses

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| OwnerId | integer | NO |  | NO |
| TenantId | integer | YES |  | NO |
| CategoryId | integer | NO |  | NO |
| Amount | numeric(18,2) | NO |  | NO |
| Date | timestamp with time zone | NO |  | NO |
| Note | varchar(500) | YES |  | NO |
| CreatedBy | integer | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| BranchId | integer | YES |  | NO |
| AttachmentUrl | varchar(500) | YES |  | NO |
| Status | integer | NO | 1 | NO |
| RecurringExpenseId | integer | YES |  | NO |
| ApprovedBy | integer | YES |  | NO |
| ApprovedAt | timestamp with time zone | YES |  | NO |
| RejectionReason | text | YES |  | NO |
| RouteId | integer | YES |  | NO |
| ClaimableVat | numeric(18,4) | YES |  | NO |
| IsEntertainment | integer | NO | 0 | NO |
| IsTaxClaimable | integer | NO | 0 | NO |
| PartialCreditPct | numeric(18,4) | NO | 0.0 | NO |
| TaxType | text | YES |  | NO |
| TotalAmount | numeric(18,4) | YES |  | NO |
| VatAmount | numeric(18,4) | YES |  | NO |
| VatRate | numeric(18,4) | YES |  | NO |
| VatInclusive | boolean | YES |  | NO |
| PaidFrom | integer | NO | 0 | NO |

| Constraint | Definition |
|---|---|
| Expenses_Amount_not_null | NOT NULL "Amount" |
| Expenses_CategoryId_not_null | NOT NULL "CategoryId" |
| Expenses_CreatedAt_not_null | NOT NULL "CreatedAt" |
| Expenses_CreatedBy_not_null | NOT NULL "CreatedBy" |
| Expenses_Date_not_null | NOT NULL "Date" |
| Expenses_Id_not_null | NOT NULL "Id" |
| Expenses_IsEntertainment_not_null | NOT NULL "IsEntertainment" |
| Expenses_IsTaxClaimable_not_null | NOT NULL "IsTaxClaimable" |
| Expenses_OwnerId_not_null | NOT NULL "OwnerId" |
| Expenses_PaidFrom_not_null | NOT NULL "PaidFrom" |
| Expenses_PartialCreditPct_not_null | NOT NULL "PartialCreditPct" |
| Expenses_Status_not_null | NOT NULL "Status" |
| FK_Expenses_Branches_BranchId | FOREIGN KEY ("BranchId") REFERENCES "Branches"("Id") |
| FK_Expenses_ExpenseCategories_CategoryId | FOREIGN KEY ("CategoryId") REFERENCES "ExpenseCategories"("Id") ON DELETE CASCADE |
| FK_Expenses_Users_CreatedBy | FOREIGN KEY ("CreatedBy") REFERENCES "Users"("Id") ON DELETE CASCADE |
| PK_Expenses | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_Expenses_BranchId | CREATE INDEX "IX_Expenses_BranchId" ON public."Expenses" USING btree ("BranchId") |
| IX_Expenses_CategoryId | CREATE INDEX "IX_Expenses_CategoryId" ON public."Expenses" USING btree ("CategoryId") |
| IX_Expenses_CreatedBy | CREATE INDEX "IX_Expenses_CreatedBy" ON public."Expenses" USING btree ("CreatedBy") |
| IX_Expenses_TenantId | CREATE INDEX "IX_Expenses_TenantId" ON public."Expenses" USING btree ("TenantId") |
| IX_Expenses_TenantId_BranchId | CREATE INDEX "IX_Expenses_TenantId_BranchId" ON public."Expenses" USING btree ("TenantId", "BranchId") WHERE ("BranchId" IS NOT NULL) |
| IX_Expenses_TenantId_CategoryId | CREATE INDEX "IX_Expenses_TenantId_CategoryId" ON public."Expenses" USING btree ("TenantId", "CategoryId") WHERE ("CategoryId" IS NOT NULL) |
| IX_Expenses_TenantId_RouteId | CREATE INDEX "IX_Expenses_TenantId_RouteId" ON public."Expenses" USING btree ("TenantId", "RouteId") WHERE ("RouteId" IS NOT NULL) |
| PK_Expenses | CREATE UNIQUE INDEX "PK_Expenses" ON public."Expenses" USING btree ("Id") |
| idx_expenses_createdat | CREATE INDEX idx_expenses_createdat ON public."Expenses" USING btree ("CreatedAt" DESC) |
| idx_expenses_tenantid | CREATE INDEX idx_expenses_tenantid ON public."Expenses" USING btree ("TenantId") |

## FailedLoginAttempts

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO | nextval('"FailedLoginAttempts_Id_seq"'::regclass) | NO |
| Email | varchar(100) | NO |  | NO |
| FailedCount | integer | NO | 1 | NO |
| LockoutUntil | timestamp with time zone | YES |  | NO |
| LastAttemptAt | timestamp with time zone | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| UpdatedAt | timestamp with time zone | YES |  | NO |

| Constraint | Definition |
|---|---|
| FailedLoginAttempts_CreatedAt_not_null | NOT NULL "CreatedAt" |
| FailedLoginAttempts_Email_not_null | NOT NULL "Email" |
| FailedLoginAttempts_FailedCount_not_null | NOT NULL "FailedCount" |
| FailedLoginAttempts_Id_not_null | NOT NULL "Id" |
| FailedLoginAttempts_LastAttemptAt_not_null | NOT NULL "LastAttemptAt" |
| FailedLoginAttempts_pkey | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| FailedLoginAttempts_pkey | CREATE UNIQUE INDEX "FailedLoginAttempts_pkey" ON public."FailedLoginAttempts" USING btree ("Id") |
| IX_FailedLoginAttempts_Email | CREATE UNIQUE INDEX "IX_FailedLoginAttempts_Email" ON public."FailedLoginAttempts" USING btree ("Email") |
| IX_FailedLoginAttempts_LastAttemptAt | CREATE INDEX "IX_FailedLoginAttempts_LastAttemptAt" ON public."FailedLoginAttempts" USING btree ("LastAttemptAt") |
| IX_FailedLoginAttempts_LockoutUntil | CREATE INDEX "IX_FailedLoginAttempts_LockoutUntil" ON public."FailedLoginAttempts" USING btree ("LockoutUntil") |

## HeldInvoices

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO | nextval('"HeldInvoices_Id_seq"'::regclass) | NO |
| TenantId | integer | NO |  | NO |
| UserId | integer | NO |  | NO |
| Name | varchar(200) | NO |  | NO |
| InvoiceData | text | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| RoundOff | numeric | NO | 0 | NO |

| Constraint | Definition |
|---|---|
| FK_HeldInvoices_Users_UserId | FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE |
| HeldInvoices_CreatedAt_not_null | NOT NULL "CreatedAt" |
| HeldInvoices_Id_not_null | NOT NULL "Id" |
| HeldInvoices_InvoiceData_not_null | NOT NULL "InvoiceData" |
| HeldInvoices_Name_not_null | NOT NULL "Name" |
| HeldInvoices_RoundOff_not_null | NOT NULL "RoundOff" |
| HeldInvoices_TenantId_not_null | NOT NULL "TenantId" |
| HeldInvoices_UserId_not_null | NOT NULL "UserId" |
| HeldInvoices_pkey | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| HeldInvoices_pkey | CREATE UNIQUE INDEX "HeldInvoices_pkey" ON public."HeldInvoices" USING btree ("Id") |
| IX_HeldInvoices_UserId | CREATE INDEX "IX_HeldInvoices_UserId" ON public."HeldInvoices" USING btree ("UserId") |

## InventoryTransactions

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| OwnerId | integer | NO |  | NO |
| TenantId | integer | YES |  | NO |
| ProductId | integer | NO |  | NO |
| ChangeQty | numeric(18,2) | NO |  | NO |
| TransactionType | text | NO |  | NO |
| RefId | integer | YES |  | NO |
| Reason | text | YES |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |

| Constraint | Definition |
|---|---|
| FK_InventoryTransactions_Products_ProductId | FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE |
| InventoryTransactions_ChangeQty_not_null | NOT NULL "ChangeQty" |
| InventoryTransactions_CreatedAt_not_null | NOT NULL "CreatedAt" |
| InventoryTransactions_Id_not_null | NOT NULL "Id" |
| InventoryTransactions_OwnerId_not_null | NOT NULL "OwnerId" |
| InventoryTransactions_ProductId_not_null | NOT NULL "ProductId" |
| InventoryTransactions_TransactionType_not_null | NOT NULL "TransactionType" |
| PK_InventoryTransactions | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_InventoryTransactions_ProductId | CREATE INDEX "IX_InventoryTransactions_ProductId" ON public."InventoryTransactions" USING btree ("ProductId") |
| IX_InventoryTransactions_TenantId_TransactionType_CreatedAt | CREATE INDEX "IX_InventoryTransactions_TenantId_TransactionType_CreatedAt" ON public."InventoryTransactions" USING btree ("TenantId", "TransactionType", "CreatedAt" DESC) |
| PK_InventoryTransactions | CREATE UNIQUE INDEX "PK_InventoryTransactions" ON public."InventoryTransactions" USING btree ("Id") |

## InvoiceTemplates

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| Name | varchar(200) | NO |  | NO |
| Version | varchar(50) | NO |  | NO |
| CreatedBy | integer | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| UpdatedAt | timestamp with time zone | YES |  | NO |
| HtmlCode | text | NO |  | NO |
| CssCode | text | YES |  | NO |
| IsActive | boolean | NO |  | NO |
| Description | varchar(1000) | YES |  | NO |
| TenantId | integer | YES |  | NO |

| Constraint | Definition |
|---|---|
| FK_InvoiceTemplates_Users_CreatedBy | FOREIGN KEY ("CreatedBy") REFERENCES "Users"("Id") ON DELETE CASCADE |
| InvoiceTemplates_CreatedAt_not_null | NOT NULL "CreatedAt" |
| InvoiceTemplates_CreatedBy_not_null | NOT NULL "CreatedBy" |
| InvoiceTemplates_HtmlCode_not_null | NOT NULL "HtmlCode" |
| InvoiceTemplates_Id_not_null | NOT NULL "Id" |
| InvoiceTemplates_IsActive_not_null | NOT NULL "IsActive" |
| InvoiceTemplates_Name_not_null | NOT NULL "Name" |
| InvoiceTemplates_Version_not_null | NOT NULL "Version" |
| PK_InvoiceTemplates | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_InvoiceTemplates_CreatedBy | CREATE INDEX "IX_InvoiceTemplates_CreatedBy" ON public."InvoiceTemplates" USING btree ("CreatedBy") |
| IX_InvoiceTemplates_IsActive | CREATE INDEX "IX_InvoiceTemplates_IsActive" ON public."InvoiceTemplates" USING btree ("IsActive") |
| IX_InvoiceTemplates_TenantId | CREATE INDEX "IX_InvoiceTemplates_TenantId" ON public."InvoiceTemplates" USING btree ("TenantId") |
| PK_InvoiceTemplates | CREATE UNIQUE INDEX "PK_InvoiceTemplates" ON public."InvoiceTemplates" USING btree ("Id") |

## InvoiceVersions

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| OwnerId | integer | NO |  | NO |
| TenantId | integer | YES |  | NO |
| SaleId | integer | NO |  | NO |
| VersionNumber | integer | NO |  | NO |
| CreatedById | integer | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| DataJson | jsonb | NO |  | NO |
| EditReason | varchar(500) | YES |  | NO |
| DiffSummary | varchar(1000) | YES |  | NO |

| Constraint | Definition |
|---|---|
| FK_InvoiceVersions_Sales_SaleId | FOREIGN KEY ("SaleId") REFERENCES "Sales"("Id") ON DELETE CASCADE |
| FK_InvoiceVersions_Users_CreatedById | FOREIGN KEY ("CreatedById") REFERENCES "Users"("Id") ON DELETE CASCADE |
| InvoiceVersions_CreatedAt_not_null | NOT NULL "CreatedAt" |
| InvoiceVersions_CreatedById_not_null | NOT NULL "CreatedById" |
| InvoiceVersions_DataJson_not_null | NOT NULL "DataJson" |
| InvoiceVersions_Id_not_null | NOT NULL "Id" |
| InvoiceVersions_OwnerId_not_null | NOT NULL "OwnerId" |
| InvoiceVersions_SaleId_not_null | NOT NULL "SaleId" |
| InvoiceVersions_VersionNumber_not_null | NOT NULL "VersionNumber" |
| PK_InvoiceVersions | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_InvoiceVersions_CreatedById | CREATE INDEX "IX_InvoiceVersions_CreatedById" ON public."InvoiceVersions" USING btree ("CreatedById") |
| IX_InvoiceVersions_SaleId | CREATE INDEX "IX_InvoiceVersions_SaleId" ON public."InvoiceVersions" USING btree ("SaleId") |
| IX_InvoiceVersions_SaleId_VersionNumber | CREATE INDEX "IX_InvoiceVersions_SaleId_VersionNumber" ON public."InvoiceVersions" USING btree ("SaleId", "VersionNumber") |
| PK_InvoiceVersions | CREATE UNIQUE INDEX "PK_InvoiceVersions" ON public."InvoiceVersions" USING btree ("Id") |

## PaymentIdempotencies

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| IdempotencyKey | varchar(100) | NO |  | NO |
| PaymentId | integer | NO |  | NO |
| UserId | integer | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| ResponseSnapshot | jsonb | YES |  | NO |

| Constraint | Definition |
|---|---|
| FK_PaymentIdempotencies_Payments_PaymentId | FOREIGN KEY ("PaymentId") REFERENCES "Payments"("Id") ON DELETE CASCADE |
| FK_PaymentIdempotencies_Users_UserId | FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE |
| PK_PaymentIdempotencies | PRIMARY KEY ("IdempotencyKey") |
| PaymentIdempotencies_CreatedAt_not_null | NOT NULL "CreatedAt" |
| PaymentIdempotencies_IdempotencyKey_not_null | NOT NULL "IdempotencyKey" |
| PaymentIdempotencies_PaymentId_not_null | NOT NULL "PaymentId" |
| PaymentIdempotencies_UserId_not_null | NOT NULL "UserId" |

| Index | Definition |
|---|---|
| IX_PaymentIdempotencies_IdempotencyKey | CREATE UNIQUE INDEX "IX_PaymentIdempotencies_IdempotencyKey" ON public."PaymentIdempotencies" USING btree ("IdempotencyKey") |
| IX_PaymentIdempotencies_PaymentId | CREATE INDEX "IX_PaymentIdempotencies_PaymentId" ON public."PaymentIdempotencies" USING btree ("PaymentId") |
| IX_PaymentIdempotencies_UserId | CREATE INDEX "IX_PaymentIdempotencies_UserId" ON public."PaymentIdempotencies" USING btree ("UserId") |
| PK_PaymentIdempotencies | CREATE UNIQUE INDEX "PK_PaymentIdempotencies" ON public."PaymentIdempotencies" USING btree ("IdempotencyKey") |

## PaymentReceipts

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| TenantId | integer | NO |  | NO |
| ReceiptNumber | text | NO |  | NO |
| PaymentId | integer | NO |  | NO |
| GeneratedAt | timestamp with time zone | NO |  | NO |
| GeneratedByUserId | integer | NO |  | NO |
| PdfStoragePath | text | YES |  | NO |
| SnapshotJson | text | YES |  | NO |

| Constraint | Definition |
|---|---|
| FK_PaymentReceipts_Payments_PaymentId | FOREIGN KEY ("PaymentId") REFERENCES "Payments"("Id") ON DELETE CASCADE |
| FK_PaymentReceipts_Users_GeneratedByUserId | FOREIGN KEY ("GeneratedByUserId") REFERENCES "Users"("Id") ON DELETE CASCADE |
| PK_PaymentReceipts | PRIMARY KEY ("Id") |
| PaymentReceipts_GeneratedAt_not_null | NOT NULL "GeneratedAt" |
| PaymentReceipts_GeneratedByUserId_not_null | NOT NULL "GeneratedByUserId" |
| PaymentReceipts_Id_not_null | NOT NULL "Id" |
| PaymentReceipts_PaymentId_not_null | NOT NULL "PaymentId" |
| PaymentReceipts_ReceiptNumber_not_null | NOT NULL "ReceiptNumber" |
| PaymentReceipts_TenantId_not_null | NOT NULL "TenantId" |

| Index | Definition |
|---|---|
| IX_PaymentReceipts_GeneratedByUserId | CREATE INDEX "IX_PaymentReceipts_GeneratedByUserId" ON public."PaymentReceipts" USING btree ("GeneratedByUserId") |
| IX_PaymentReceipts_PaymentId | CREATE INDEX "IX_PaymentReceipts_PaymentId" ON public."PaymentReceipts" USING btree ("PaymentId") |
| IX_PaymentReceipts_TenantId_PaymentId | CREATE UNIQUE INDEX "IX_PaymentReceipts_TenantId_PaymentId" ON public."PaymentReceipts" USING btree ("TenantId", "PaymentId") WHERE ("SnapshotJson" IS NOT NULL) |
| IX_PaymentReceipts_TenantId_ReceiptNumber | CREATE UNIQUE INDEX "IX_PaymentReceipts_TenantId_ReceiptNumber" ON public."PaymentReceipts" USING btree ("TenantId", "ReceiptNumber") |
| PK_PaymentReceipts | CREATE UNIQUE INDEX "PK_PaymentReceipts" ON public."PaymentReceipts" USING btree ("Id") |

## Payments

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| OwnerId | integer | NO |  | NO |
| TenantId | integer | YES |  | NO |
| SaleId | integer | YES |  | NO |
| CustomerId | integer | YES |  | NO |
| Amount | numeric(18,2) | NO |  | NO |
| Mode | text | NO |  | NO |
| Reference | varchar(200) | YES |  | NO |
| Status | text | NO |  | NO |
| PaymentDate | timestamp with time zone | NO |  | NO |
| CreatedBy | integer | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| UpdatedAt | timestamp with time zone | YES |  | NO |
| RowVersion | bytea | YES |  | NO |
| SaleReturnId | integer | YES |  | NO |
| IsSettlementAdjustment | boolean | NO | false | NO |
| ParentPaymentId | integer | YES |  | NO |

| Constraint | Definition |
|---|---|
| FK_Payments_Customers_CustomerId | FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") |
| FK_Payments_Sales_SaleId | FOREIGN KEY ("SaleId") REFERENCES "Sales"("Id") |
| FK_Payments_Users_CreatedBy | FOREIGN KEY ("CreatedBy") REFERENCES "Users"("Id") ON DELETE CASCADE |
| PK_Payments | PRIMARY KEY ("Id") |
| Payments_Amount_not_null | NOT NULL "Amount" |
| Payments_CreatedAt_not_null | NOT NULL "CreatedAt" |
| Payments_CreatedBy_not_null | NOT NULL "CreatedBy" |
| Payments_Id_not_null | NOT NULL "Id" |
| Payments_IsSettlementAdjustment_not_null | NOT NULL "IsSettlementAdjustment" |
| Payments_Mode_not_null | NOT NULL "Mode" |
| Payments_OwnerId_not_null | NOT NULL "OwnerId" |
| Payments_PaymentDate_not_null | NOT NULL "PaymentDate" |
| Payments_Status_not_null | NOT NULL "Status" |

| Index | Definition |
|---|---|
| IX_Payments_CreatedBy | CREATE INDEX "IX_Payments_CreatedBy" ON public."Payments" USING btree ("CreatedBy") |
| IX_Payments_CustomerId | CREATE INDEX "IX_Payments_CustomerId" ON public."Payments" USING btree ("CustomerId") |
| IX_Payments_ParentPaymentId | CREATE INDEX "IX_Payments_ParentPaymentId" ON public."Payments" USING btree ("ParentPaymentId") |
| IX_Payments_SaleId | CREATE INDEX "IX_Payments_SaleId" ON public."Payments" USING btree ("SaleId") |
| IX_Payments_TenantId_SaleId | CREATE INDEX "IX_Payments_TenantId_SaleId" ON public."Payments" USING btree ("TenantId", "SaleId") WHERE ("SaleId" IS NOT NULL) |
| IX_Payments_TenantId_Status | CREATE INDEX "IX_Payments_TenantId_Status" ON public."Payments" USING btree ("TenantId", "Status") |
| PK_Payments | CREATE UNIQUE INDEX "PK_Payments" ON public."Payments" USING btree ("Id") |
| idx_payments_createdat | CREATE INDEX idx_payments_createdat ON public."Payments" USING btree ("CreatedAt" DESC) |
| idx_payments_customer | CREATE INDEX idx_payments_customer ON public."Payments" USING btree ("CustomerId", "CreatedAt" DESC) |
| idx_payments_tenant_created | CREATE INDEX idx_payments_tenant_created ON public."Payments" USING btree ("TenantId", "CreatedAt" DESC) |
| idx_payments_tenantid | CREATE INDEX idx_payments_tenantid ON public."Payments" USING btree ("TenantId") |

## PriceChangeLogs

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| OwnerId | integer | NO |  | NO |
| TenantId | integer | YES |  | NO |
| ProductId | integer | NO |  | NO |
| OldPrice | numeric(18,2) | NO |  | NO |
| NewPrice | numeric(18,2) | NO |  | NO |
| PriceDifference | numeric(18,2) | NO |  | NO |
| ChangedBy | integer | NO |  | NO |
| Reason | varchar(500) | YES |  | NO |
| ChangedAt | timestamp with time zone | NO |  | NO |

| Constraint | Definition |
|---|---|
| FK_PriceChangeLogs_Products_ProductId | FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE |
| FK_PriceChangeLogs_Users_ChangedBy | FOREIGN KEY ("ChangedBy") REFERENCES "Users"("Id") ON DELETE CASCADE |
| PK_PriceChangeLogs | PRIMARY KEY ("Id") |
| PriceChangeLogs_ChangedAt_not_null | NOT NULL "ChangedAt" |
| PriceChangeLogs_ChangedBy_not_null | NOT NULL "ChangedBy" |
| PriceChangeLogs_Id_not_null | NOT NULL "Id" |
| PriceChangeLogs_NewPrice_not_null | NOT NULL "NewPrice" |
| PriceChangeLogs_OldPrice_not_null | NOT NULL "OldPrice" |
| PriceChangeLogs_OwnerId_not_null | NOT NULL "OwnerId" |
| PriceChangeLogs_PriceDifference_not_null | NOT NULL "PriceDifference" |
| PriceChangeLogs_ProductId_not_null | NOT NULL "ProductId" |

| Index | Definition |
|---|---|
| IX_PriceChangeLogs_ChangedBy | CREATE INDEX "IX_PriceChangeLogs_ChangedBy" ON public."PriceChangeLogs" USING btree ("ChangedBy") |
| IX_PriceChangeLogs_ProductId | CREATE INDEX "IX_PriceChangeLogs_ProductId" ON public."PriceChangeLogs" USING btree ("ProductId") |
| PK_PriceChangeLogs | CREATE UNIQUE INDEX "PK_PriceChangeLogs" ON public."PriceChangeLogs" USING btree ("Id") |

## ProductCategories

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO | nextval('"ProductCategories_Id_seq"'::regclass) | NO |
| TenantId | integer | NO |  | NO |
| Name | varchar(100) | NO |  | NO |
| Description | varchar(500) | YES |  | NO |
| ColorCode | varchar(20) | YES |  | NO |
| IsActive | boolean | NO | true | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| UpdatedAt | timestamp with time zone | NO |  | NO |

| Constraint | Definition |
|---|---|
| ProductCategories_CreatedAt_not_null | NOT NULL "CreatedAt" |
| ProductCategories_Id_not_null | NOT NULL "Id" |
| ProductCategories_IsActive_not_null | NOT NULL "IsActive" |
| ProductCategories_Name_not_null | NOT NULL "Name" |
| ProductCategories_TenantId_not_null | NOT NULL "TenantId" |
| ProductCategories_UpdatedAt_not_null | NOT NULL "UpdatedAt" |
| ProductCategories_pkey | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_ProductCategories_TenantId_Name | CREATE UNIQUE INDEX "IX_ProductCategories_TenantId_Name" ON public."ProductCategories" USING btree ("TenantId", "Name") |
| ProductCategories_pkey | CREATE UNIQUE INDEX "ProductCategories_pkey" ON public."ProductCategories" USING btree ("Id") |

## Products

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| OwnerId | integer | NO |  | NO |
| TenantId | integer | YES |  | NO |
| Sku | varchar(50) | NO |  | NO |
| NameEn | varchar(200) | NO |  | NO |
| NameAr | varchar(200) | YES |  | NO |
| UnitType | varchar(20) | NO |  | NO |
| ConversionToBase | numeric(18,4) | NO |  | NO |
| CostPrice | numeric(18,2) | NO |  | NO |
| SellPrice | numeric(18,2) | NO |  | NO |
| StockQty | numeric(18,2) | NO |  | NO |
| ReorderLevel | integer | NO |  | NO |
| ExpiryDate | timestamp with time zone | YES |  | NO |
| DescriptionEn | text | YES |  | NO |
| DescriptionAr | text | YES |  | NO |
| RowVersion | bytea | NO | '\x00'::bytea | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| UpdatedAt | timestamp with time zone | NO |  | NO |
| Barcode | varchar(100) | YES |  | NO |
| ImageUrl | varchar(500) | YES |  | NO |
| CategoryId | integer | YES |  | NO |
| IsActive | boolean | NO | true | NO |

| Constraint | Definition |
|---|---|
| FK_Products_ProductCategories_CategoryId | FOREIGN KEY ("CategoryId") REFERENCES "ProductCategories"("Id") ON DELETE SET NULL |
| PK_Products | PRIMARY KEY ("Id") |
| Products_ConversionToBase_not_null | NOT NULL "ConversionToBase" |
| Products_CostPrice_not_null | NOT NULL "CostPrice" |
| Products_CreatedAt_not_null | NOT NULL "CreatedAt" |
| Products_Id_not_null | NOT NULL "Id" |
| Products_IsActive_not_null | NOT NULL "IsActive" |
| Products_NameEn_not_null | NOT NULL "NameEn" |
| Products_OwnerId_not_null | NOT NULL "OwnerId" |
| Products_ReorderLevel_not_null | NOT NULL "ReorderLevel" |
| Products_RowVersion_not_null | NOT NULL "RowVersion" |
| Products_SellPrice_not_null | NOT NULL "SellPrice" |
| Products_Sku_not_null | NOT NULL "Sku" |
| Products_StockQty_not_null | NOT NULL "StockQty" |
| Products_UnitType_not_null | NOT NULL "UnitType" |
| Products_UpdatedAt_not_null | NOT NULL "UpdatedAt" |

| Index | Definition |
|---|---|
| IX_Products_Barcode | CREATE INDEX "IX_Products_Barcode" ON public."Products" USING btree ("Barcode") |
| IX_Products_CategoryId | CREATE INDEX "IX_Products_CategoryId" ON public."Products" USING btree ("CategoryId") |
| IX_Products_ImageUrl | CREATE INDEX "IX_Products_ImageUrl" ON public."Products" USING btree ("ImageUrl") WHERE ("ImageUrl" IS NOT NULL) |
| IX_Products_IsActive | CREATE INDEX "IX_Products_IsActive" ON public."Products" USING btree ("IsActive") |
| IX_Products_TenantId_Barcode | CREATE UNIQUE INDEX "IX_Products_TenantId_Barcode" ON public."Products" USING btree ("TenantId", "Barcode") WHERE ("Barcode" IS NOT NULL) |
| IX_Products_TenantId_Sku | CREATE UNIQUE INDEX "IX_Products_TenantId_Sku" ON public."Products" USING btree ("TenantId", "Sku") |
| PK_Products | CREATE UNIQUE INDEX "PK_Products" ON public."Products" USING btree ("Id") |
| idx_products_tenant_name | CREATE INDEX idx_products_tenant_name ON public."Products" USING btree ("TenantId", "NameEn") |
| idx_products_tenant_sku | CREATE INDEX idx_products_tenant_sku ON public."Products" USING btree ("TenantId", "Sku") |
| idx_products_tenantid | CREATE INDEX idx_products_tenantid ON public."Products" USING btree ("TenantId") |

## PurchaseItems

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| PurchaseId | integer | NO |  | NO |
| ProductId | integer | NO |  | NO |
| UnitType | varchar(20) | NO |  | NO |
| Qty | numeric(18,2) | NO |  | NO |
| UnitCost | numeric(18,2) | NO |  | NO |
| UnitCostExclVat | numeric(18,2) | YES |  | NO |
| VatAmount | numeric(18,2) | YES |  | NO |
| LineTotal | numeric(18,2) | NO |  | NO |
| ConversionAtPurchase | numeric(18,6) | YES |  | NO |
| CostCapturedAt | timestamp with time zone | YES |  | NO |

| Constraint | Definition |
|---|---|
| FK_PurchaseItems_Products_ProductId | FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE |
| FK_PurchaseItems_Purchases_PurchaseId | FOREIGN KEY ("PurchaseId") REFERENCES "Purchases"("Id") ON DELETE CASCADE |
| PK_PurchaseItems | PRIMARY KEY ("Id") |
| PurchaseItems_Id_not_null | NOT NULL "Id" |
| PurchaseItems_LineTotal_not_null | NOT NULL "LineTotal" |
| PurchaseItems_ProductId_not_null | NOT NULL "ProductId" |
| PurchaseItems_PurchaseId_not_null | NOT NULL "PurchaseId" |
| PurchaseItems_Qty_not_null | NOT NULL "Qty" |
| PurchaseItems_UnitCost_not_null | NOT NULL "UnitCost" |
| PurchaseItems_UnitType_not_null | NOT NULL "UnitType" |

| Index | Definition |
|---|---|
| IX_PurchaseItems_ProductId | CREATE INDEX "IX_PurchaseItems_ProductId" ON public."PurchaseItems" USING btree ("ProductId") |
| IX_PurchaseItems_PurchaseId | CREATE INDEX "IX_PurchaseItems_PurchaseId" ON public."PurchaseItems" USING btree ("PurchaseId") |
| PK_PurchaseItems | CREATE UNIQUE INDEX "PK_PurchaseItems" ON public."PurchaseItems" USING btree ("Id") |

## PurchaseReturnItems

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| PurchaseReturnId | integer | NO |  | NO |
| PurchaseItemId | integer | NO |  | NO |
| ProductId | integer | NO |  | NO |
| UnitType | varchar(20) | NO |  | NO |
| Qty | numeric(18,2) | NO |  | NO |
| UnitCost | numeric(18,2) | NO |  | NO |
| LineTotal | numeric(18,2) | NO |  | NO |
| Reason | varchar(200) | YES |  | NO |

| Constraint | Definition |
|---|---|
| FK_PurchaseReturnItems_Products_ProductId | FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE |
| FK_PurchaseReturnItems_PurchaseItems_PurchaseItemId | FOREIGN KEY ("PurchaseItemId") REFERENCES "PurchaseItems"("Id") ON DELETE CASCADE |
| FK_PurchaseReturnItems_PurchaseReturns_PurchaseReturnId | FOREIGN KEY ("PurchaseReturnId") REFERENCES "PurchaseReturns"("Id") ON DELETE CASCADE |
| PK_PurchaseReturnItems | PRIMARY KEY ("Id") |
| PurchaseReturnItems_Id_not_null | NOT NULL "Id" |
| PurchaseReturnItems_LineTotal_not_null | NOT NULL "LineTotal" |
| PurchaseReturnItems_ProductId_not_null | NOT NULL "ProductId" |
| PurchaseReturnItems_PurchaseItemId_not_null | NOT NULL "PurchaseItemId" |
| PurchaseReturnItems_PurchaseReturnId_not_null | NOT NULL "PurchaseReturnId" |
| PurchaseReturnItems_Qty_not_null | NOT NULL "Qty" |
| PurchaseReturnItems_UnitCost_not_null | NOT NULL "UnitCost" |
| PurchaseReturnItems_UnitType_not_null | NOT NULL "UnitType" |

| Index | Definition |
|---|---|
| IX_PurchaseReturnItems_ProductId | CREATE INDEX "IX_PurchaseReturnItems_ProductId" ON public."PurchaseReturnItems" USING btree ("ProductId") |
| IX_PurchaseReturnItems_PurchaseItemId | CREATE INDEX "IX_PurchaseReturnItems_PurchaseItemId" ON public."PurchaseReturnItems" USING btree ("PurchaseItemId") |
| IX_PurchaseReturnItems_PurchaseReturnId | CREATE INDEX "IX_PurchaseReturnItems_PurchaseReturnId" ON public."PurchaseReturnItems" USING btree ("PurchaseReturnId") |
| PK_PurchaseReturnItems | CREATE UNIQUE INDEX "PK_PurchaseReturnItems" ON public."PurchaseReturnItems" USING btree ("Id") |

## PurchaseReturns

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| OwnerId | integer | NO |  | NO |
| TenantId | integer | YES |  | NO |
| PurchaseId | integer | NO |  | NO |
| SupplierId | integer | YES |  | NO |
| ReturnNo | varchar(100) | NO |  | NO |
| ReturnDate | timestamp with time zone | NO |  | NO |
| Subtotal | numeric(18,2) | NO |  | NO |
| VatTotal | numeric(18,2) | NO |  | NO |
| GrandTotal | numeric(18,2) | NO |  | NO |
| Reason | varchar(500) | YES |  | NO |
| Status | text | NO |  | NO |
| CreatedBy | integer | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |

| Constraint | Definition |
|---|---|
| FK_PurchaseReturns_Purchases_PurchaseId | FOREIGN KEY ("PurchaseId") REFERENCES "Purchases"("Id") ON DELETE CASCADE |
| FK_PurchaseReturns_Users_CreatedBy | FOREIGN KEY ("CreatedBy") REFERENCES "Users"("Id") ON DELETE CASCADE |
| PK_PurchaseReturns | PRIMARY KEY ("Id") |
| PurchaseReturns_CreatedAt_not_null | NOT NULL "CreatedAt" |
| PurchaseReturns_CreatedBy_not_null | NOT NULL "CreatedBy" |
| PurchaseReturns_GrandTotal_not_null | NOT NULL "GrandTotal" |
| PurchaseReturns_Id_not_null | NOT NULL "Id" |
| PurchaseReturns_OwnerId_not_null | NOT NULL "OwnerId" |
| PurchaseReturns_PurchaseId_not_null | NOT NULL "PurchaseId" |
| PurchaseReturns_ReturnDate_not_null | NOT NULL "ReturnDate" |
| PurchaseReturns_ReturnNo_not_null | NOT NULL "ReturnNo" |
| PurchaseReturns_Status_not_null | NOT NULL "Status" |
| PurchaseReturns_Subtotal_not_null | NOT NULL "Subtotal" |
| PurchaseReturns_VatTotal_not_null | NOT NULL "VatTotal" |

| Index | Definition |
|---|---|
| IX_PurchaseReturns_CreatedBy | CREATE INDEX "IX_PurchaseReturns_CreatedBy" ON public."PurchaseReturns" USING btree ("CreatedBy") |
| IX_PurchaseReturns_PurchaseId | CREATE INDEX "IX_PurchaseReturns_PurchaseId" ON public."PurchaseReturns" USING btree ("PurchaseId") |
| IX_PurchaseReturns_TenantId_ReturnNo | CREATE UNIQUE INDEX "IX_PurchaseReturns_TenantId_ReturnNo" ON public."PurchaseReturns" USING btree ("TenantId", "ReturnNo") |
| PK_PurchaseReturns | CREATE UNIQUE INDEX "PK_PurchaseReturns" ON public."PurchaseReturns" USING btree ("Id") |

## Purchases

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| OwnerId | integer | NO |  | NO |
| TenantId | integer | YES |  | NO |
| SupplierName | varchar(200) | NO |  | NO |
| InvoiceNo | varchar(100) | NO |  | NO |
| ExternalReference | varchar(200) | YES |  | NO |
| ExpenseCategory | varchar(100) | YES |  | NO |
| PurchaseDate | timestamp with time zone | NO |  | NO |
| Subtotal | numeric(18,2) | YES |  | NO |
| VatTotal | numeric(18,2) | YES |  | NO |
| TotalAmount | numeric(18,2) | NO |  | NO |
| InvoiceFilePath | varchar(500) | YES |  | NO |
| InvoiceFileName | varchar(255) | YES |  | NO |
| CreatedBy | integer | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| AmountPaid | numeric(18,2) | YES |  | NO |
| PaymentType | varchar(20) | YES |  | NO |
| SupplierId | integer | YES |  | NO |
| DueDate | timestamp with time zone | YES |  | NO |
| IsReverseCharge | integer | NO | 0 | NO |
| IsTaxClaimable | integer | NO | 0 | NO |
| ReverseChargeVat | numeric(18,4) | YES |  | NO |

| Constraint | Definition |
|---|---|
| FK_Purchases_Suppliers_SupplierId | FOREIGN KEY ("SupplierId") REFERENCES "Suppliers"("Id") ON DELETE SET NULL |
| FK_Purchases_Users_CreatedBy | FOREIGN KEY ("CreatedBy") REFERENCES "Users"("Id") ON DELETE CASCADE |
| PK_Purchases | PRIMARY KEY ("Id") |
| Purchases_CreatedAt_not_null | NOT NULL "CreatedAt" |
| Purchases_CreatedBy_not_null | NOT NULL "CreatedBy" |
| Purchases_Id_not_null | NOT NULL "Id" |
| Purchases_InvoiceNo_not_null | NOT NULL "InvoiceNo" |
| Purchases_IsReverseCharge_not_null | NOT NULL "IsReverseCharge" |
| Purchases_IsTaxClaimable_not_null | NOT NULL "IsTaxClaimable" |
| Purchases_OwnerId_not_null | NOT NULL "OwnerId" |
| Purchases_PurchaseDate_not_null | NOT NULL "PurchaseDate" |
| Purchases_SupplierName_not_null | NOT NULL "SupplierName" |
| Purchases_TotalAmount_not_null | NOT NULL "TotalAmount" |

| Index | Definition |
|---|---|
| IX_Purchases_CreatedBy | CREATE INDEX "IX_Purchases_CreatedBy" ON public."Purchases" USING btree ("CreatedBy") |
| IX_Purchases_OwnerId_InvoiceNo | CREATE UNIQUE INDEX "IX_Purchases_OwnerId_InvoiceNo" ON public."Purchases" USING btree ("OwnerId", "InvoiceNo") |
| IX_Purchases_SupplierId | CREATE INDEX "IX_Purchases_SupplierId" ON public."Purchases" USING btree ("SupplierId") |
| IX_Purchases_TenantId_SupplierName | CREATE INDEX "IX_Purchases_TenantId_SupplierName" ON public."Purchases" USING btree ("TenantId", "SupplierName") WHERE ("SupplierName" IS NOT NULL) |
| PK_Purchases | CREATE UNIQUE INDEX "PK_Purchases" ON public."Purchases" USING btree ("Id") |
| idx_purchases_createdat | CREATE INDEX idx_purchases_createdat ON public."Purchases" USING btree ("CreatedAt" DESC) |
| idx_purchases_tenantid | CREATE INDEX idx_purchases_tenantid ON public."Purchases" USING btree ("TenantId") |

## QuotationItems

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO | nextval('"QuotationItems_Id_seq"'::regclass) | NO |
| QuotationId | integer | NO |  | NO |
| ProductId | integer | YES |  | NO |
| Description | varchar(500) | NO |  | NO |
| DescriptionSubtitle | varchar(500) | YES |  | NO |
| UnitLabel | varchar(50) | NO |  | NO |
| Qty | numeric(18,4) | NO |  | NO |
| UnitPrice | numeric(18,4) | NO |  | NO |
| VatRate | numeric(18,4) | NO |  | NO |
| VatAmount | numeric(18,2) | NO |  | NO |
| LineTotal | numeric(18,2) | NO |  | NO |
| SortOrder | integer | NO |  | NO |

| Constraint | Definition |
|---|---|
| FK_QuotationItems_Products_ProductId | FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE SET NULL |
| FK_QuotationItems_Quotations_QuotationId | FOREIGN KEY ("QuotationId") REFERENCES "Quotations"("Id") ON DELETE CASCADE |
| QuotationItems_Description_not_null | NOT NULL "Description" |
| QuotationItems_Id_not_null | NOT NULL "Id" |
| QuotationItems_LineTotal_not_null | NOT NULL "LineTotal" |
| QuotationItems_Qty_not_null | NOT NULL "Qty" |
| QuotationItems_QuotationId_not_null | NOT NULL "QuotationId" |
| QuotationItems_SortOrder_not_null | NOT NULL "SortOrder" |
| QuotationItems_UnitLabel_not_null | NOT NULL "UnitLabel" |
| QuotationItems_UnitPrice_not_null | NOT NULL "UnitPrice" |
| QuotationItems_VatAmount_not_null | NOT NULL "VatAmount" |
| QuotationItems_VatRate_not_null | NOT NULL "VatRate" |
| QuotationItems_pkey | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_QuotationItems_ProductId | CREATE INDEX "IX_QuotationItems_ProductId" ON public."QuotationItems" USING btree ("ProductId") |
| IX_QuotationItems_QuotationId | CREATE INDEX "IX_QuotationItems_QuotationId" ON public."QuotationItems" USING btree ("QuotationId") |
| QuotationItems_pkey | CREATE UNIQUE INDEX "QuotationItems_pkey" ON public."QuotationItems" USING btree ("Id") |

## Quotations

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO | nextval('"Quotations_Id_seq"'::regclass) | NO |
| OwnerId | integer | NO |  | NO |
| TenantId | integer | YES |  | NO |
| QuoteNo | varchar(50) | NO |  | NO |
| QuoteDate | timestamp with time zone | NO |  | NO |
| CustomerName | varchar(200) | YES |  | NO |
| CustomerAddress | varchar(500) | YES |  | NO |
| CustomerPhone | varchar(50) | YES |  | NO |
| CustomerEmail | varchar(100) | YES |  | NO |
| CustomerId | integer | YES |  | NO |
| Subtotal | numeric(18,2) | NO |  | NO |
| VatTotal | numeric(18,2) | NO |  | NO |
| Discount | numeric(18,2) | NO |  | NO |
| GrandTotal | numeric(18,2) | NO |  | NO |
| Status | varchar(20) | NO |  | NO |
| Notes | text | YES |  | NO |
| Salutation | varchar(200) | YES |  | NO |
| IntroLine | varchar(500) | YES |  | NO |
| ClosingLine | varchar(500) | YES |  | NO |
| CreatedBy | integer | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| LastModifiedBy | integer | YES |  | NO |
| LastModifiedAt | timestamp with time zone | YES |  | NO |
| IsDeleted | boolean | NO | false | NO |
| DeletedBy | integer | YES |  | NO |
| DeletedAt | timestamp with time zone | YES |  | NO |

| Constraint | Definition |
|---|---|
| FK_Quotations_Customers_CustomerId | FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE SET NULL |
| Quotations_CreatedAt_not_null | NOT NULL "CreatedAt" |
| Quotations_CreatedBy_not_null | NOT NULL "CreatedBy" |
| Quotations_Discount_not_null | NOT NULL "Discount" |
| Quotations_GrandTotal_not_null | NOT NULL "GrandTotal" |
| Quotations_Id_not_null | NOT NULL "Id" |
| Quotations_IsDeleted_not_null | NOT NULL "IsDeleted" |
| Quotations_OwnerId_not_null | NOT NULL "OwnerId" |
| Quotations_QuoteDate_not_null | NOT NULL "QuoteDate" |
| Quotations_QuoteNo_not_null | NOT NULL "QuoteNo" |
| Quotations_Status_not_null | NOT NULL "Status" |
| Quotations_Subtotal_not_null | NOT NULL "Subtotal" |
| Quotations_VatTotal_not_null | NOT NULL "VatTotal" |
| Quotations_pkey | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_Quotations_CustomerId | CREATE INDEX "IX_Quotations_CustomerId" ON public."Quotations" USING btree ("CustomerId") |
| IX_Quotations_TenantId | CREATE INDEX "IX_Quotations_TenantId" ON public."Quotations" USING btree ("TenantId") |
| IX_Quotations_TenantId_QuoteNo | CREATE UNIQUE INDEX "IX_Quotations_TenantId_QuoteNo" ON public."Quotations" USING btree ("TenantId", "QuoteNo") WHERE ("IsDeleted" = false) |
| Quotations_pkey | CREATE UNIQUE INDEX "Quotations_pkey" ON public."Quotations" USING btree ("Id") |

## RecurringExpenses

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| OwnerId | integer | NO |  | NO |
| TenantId | integer | YES |  | NO |
| BranchId | integer | YES |  | NO |
| CategoryId | integer | NO |  | NO |
| Amount | numeric | NO |  | NO |
| Note | varchar(500) | YES |  | NO |
| Frequency | integer | NO |  | NO |
| DayOfRecurrence | integer | YES |  | NO |
| StartDate | timestamp with time zone | NO |  | NO |
| EndDate | timestamp with time zone | YES |  | NO |
| IsActive | boolean | NO |  | NO |
| CreatedBy | integer | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| UpdatedAt | timestamp with time zone | NO |  | NO |
| CreatedByUserId | integer | NO |  | NO |

| Constraint | Definition |
|---|---|
| PK_RecurringExpenses | PRIMARY KEY ("Id") |
| RecurringExpenses_Amount_not_null | NOT NULL "Amount" |
| RecurringExpenses_CategoryId_not_null | NOT NULL "CategoryId" |
| RecurringExpenses_CreatedAt_not_null | NOT NULL "CreatedAt" |
| RecurringExpenses_CreatedByUserId_not_null | NOT NULL "CreatedByUserId" |
| RecurringExpenses_CreatedBy_not_null | NOT NULL "CreatedBy" |
| RecurringExpenses_Frequency_not_null | NOT NULL "Frequency" |
| RecurringExpenses_Id_not_null | NOT NULL "Id" |
| RecurringExpenses_IsActive_not_null | NOT NULL "IsActive" |
| RecurringExpenses_OwnerId_not_null | NOT NULL "OwnerId" |
| RecurringExpenses_StartDate_not_null | NOT NULL "StartDate" |
| RecurringExpenses_UpdatedAt_not_null | NOT NULL "UpdatedAt" |

| Index | Definition |
|---|---|
| IX_RecurringExpenses_BranchId | CREATE INDEX "IX_RecurringExpenses_BranchId" ON public."RecurringExpenses" USING btree ("BranchId") |
| IX_RecurringExpenses_CategoryId | CREATE INDEX "IX_RecurringExpenses_CategoryId" ON public."RecurringExpenses" USING btree ("CategoryId") |
| IX_RecurringExpenses_CreatedByUserId | CREATE INDEX "IX_RecurringExpenses_CreatedByUserId" ON public."RecurringExpenses" USING btree ("CreatedByUserId") |
| PK_RecurringExpenses | CREATE UNIQUE INDEX "PK_RecurringExpenses" ON public."RecurringExpenses" USING btree ("Id") |

## RecurringInvoiceItems

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| RecurringInvoiceId | integer | NO |  | NO |
| ProductId | integer | NO |  | NO |
| Qty | numeric | NO |  | NO |
| UnitPrice | numeric | NO |  | NO |
| UnitType | text | NO |  | NO |

| Constraint | Definition |
|---|---|
| FK_RecurringInvoiceItems_Products_ProductId | FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE |
| FK_RecurringInvoiceItems_RecurringInvoices_RecurringInvoiceId | FOREIGN KEY ("RecurringInvoiceId") REFERENCES "RecurringInvoices"("Id") ON DELETE CASCADE |
| PK_RecurringInvoiceItems | PRIMARY KEY ("Id") |
| RecurringInvoiceItems_Id_not_null | NOT NULL "Id" |
| RecurringInvoiceItems_ProductId_not_null | NOT NULL "ProductId" |
| RecurringInvoiceItems_Qty_not_null | NOT NULL "Qty" |
| RecurringInvoiceItems_RecurringInvoiceId_not_null | NOT NULL "RecurringInvoiceId" |
| RecurringInvoiceItems_UnitPrice_not_null | NOT NULL "UnitPrice" |
| RecurringInvoiceItems_UnitType_not_null | NOT NULL "UnitType" |

| Index | Definition |
|---|---|
| IX_RecurringInvoiceItems_ProductId | CREATE INDEX "IX_RecurringInvoiceItems_ProductId" ON public."RecurringInvoiceItems" USING btree ("ProductId") |
| IX_RecurringInvoiceItems_RecurringInvoiceId | CREATE INDEX "IX_RecurringInvoiceItems_RecurringInvoiceId" ON public."RecurringInvoiceItems" USING btree ("RecurringInvoiceId") |
| PK_RecurringInvoiceItems | CREATE UNIQUE INDEX "PK_RecurringInvoiceItems" ON public."RecurringInvoiceItems" USING btree ("Id") |

## RecurringInvoices

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| TenantId | integer | NO |  | NO |
| CustomerId | integer | NO |  | NO |
| BranchId | integer | YES |  | NO |
| RouteId | integer | YES |  | NO |
| Frequency | integer | NO |  | NO |
| DayOfRecurrence | integer | YES |  | NO |
| StartDate | timestamp with time zone | NO |  | NO |
| EndDate | timestamp with time zone | YES |  | NO |
| NextRunDate | timestamp with time zone | NO |  | NO |
| LastRunDate | timestamp with time zone | YES |  | NO |
| IsActive | boolean | NO | true | NO |
| Notes | text | YES |  | NO |
| CreatedBy | integer | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| UpdatedAt | timestamp with time zone | NO |  | NO |

| Constraint | Definition |
|---|---|
| FK_RecurringInvoices_Branches_BranchId | FOREIGN KEY ("BranchId") REFERENCES "Branches"("Id") |
| FK_RecurringInvoices_Customers_CustomerId | FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE CASCADE |
| FK_RecurringInvoices_Routes_RouteId | FOREIGN KEY ("RouteId") REFERENCES "Routes"("Id") |
| PK_RecurringInvoices | PRIMARY KEY ("Id") |
| RecurringInvoices_CreatedAt_not_null | NOT NULL "CreatedAt" |
| RecurringInvoices_CreatedBy_not_null | NOT NULL "CreatedBy" |
| RecurringInvoices_CustomerId_not_null | NOT NULL "CustomerId" |
| RecurringInvoices_Frequency_not_null | NOT NULL "Frequency" |
| RecurringInvoices_Id_not_null | NOT NULL "Id" |
| RecurringInvoices_IsActive_not_null | NOT NULL "IsActive" |
| RecurringInvoices_NextRunDate_not_null | NOT NULL "NextRunDate" |
| RecurringInvoices_StartDate_not_null | NOT NULL "StartDate" |
| RecurringInvoices_TenantId_not_null | NOT NULL "TenantId" |
| RecurringInvoices_UpdatedAt_not_null | NOT NULL "UpdatedAt" |

| Index | Definition |
|---|---|
| IX_RecurringInvoices_BranchId | CREATE INDEX "IX_RecurringInvoices_BranchId" ON public."RecurringInvoices" USING btree ("BranchId") |
| IX_RecurringInvoices_CustomerId | CREATE INDEX "IX_RecurringInvoices_CustomerId" ON public."RecurringInvoices" USING btree ("CustomerId") |
| IX_RecurringInvoices_RouteId | CREATE INDEX "IX_RecurringInvoices_RouteId" ON public."RecurringInvoices" USING btree ("RouteId") |
| PK_RecurringInvoices | CREATE UNIQUE INDEX "PK_RecurringInvoices" ON public."RecurringInvoices" USING btree ("Id") |

## RouteCustomers

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| RouteId | integer | NO |  | NO |
| CustomerId | integer | NO |  | NO |
| AssignedAt | timestamp with time zone | NO |  | NO |
| SortOrder | integer | YES |  | NO |

| Constraint | Definition |
|---|---|
| FK_RouteCustomers_Customers_CustomerId | FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") ON DELETE CASCADE |
| FK_RouteCustomers_Routes_RouteId | FOREIGN KEY ("RouteId") REFERENCES "Routes"("Id") ON DELETE CASCADE |
| RouteCustomers_AssignedAt_not_null | NOT NULL "AssignedAt" |
| RouteCustomers_CustomerId_not_null | NOT NULL "CustomerId" |
| RouteCustomers_Id_not_null | NOT NULL "Id" |
| RouteCustomers_RouteId_not_null | NOT NULL "RouteId" |
| RouteCustomers_pkey | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_RouteCustomers_CustomerId | CREATE INDEX "IX_RouteCustomers_CustomerId" ON public."RouteCustomers" USING btree ("CustomerId") |
| IX_RouteCustomers_RouteId | CREATE INDEX "IX_RouteCustomers_RouteId" ON public."RouteCustomers" USING btree ("RouteId") |
| IX_RouteCustomers_RouteId_CustomerId | CREATE UNIQUE INDEX "IX_RouteCustomers_RouteId_CustomerId" ON public."RouteCustomers" USING btree ("RouteId", "CustomerId") |
| RouteCustomers_pkey | CREATE UNIQUE INDEX "RouteCustomers_pkey" ON public."RouteCustomers" USING btree ("Id") |

## RouteExpenses

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| RouteId | integer | NO |  | NO |
| TenantId | integer | NO |  | NO |
| Category | text | NO |  | NO |
| Amount | numeric(18,2) | NO |  | NO |
| ExpenseDate | timestamp with time zone | NO |  | NO |
| Description | varchar(500) | YES |  | NO |
| CreatedBy | integer | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |

| Constraint | Definition |
|---|---|
| FK_RouteExpenses_Routes_RouteId | FOREIGN KEY ("RouteId") REFERENCES "Routes"("Id") ON DELETE CASCADE |
| FK_RouteExpenses_Tenants_TenantId | FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE CASCADE |
| FK_RouteExpenses_Users_CreatedBy | FOREIGN KEY ("CreatedBy") REFERENCES "Users"("Id") ON DELETE CASCADE |
| RouteExpenses_Amount_not_null | NOT NULL "Amount" |
| RouteExpenses_Category_not_null | NOT NULL "Category" |
| RouteExpenses_CreatedAt_not_null | NOT NULL "CreatedAt" |
| RouteExpenses_CreatedBy_not_null | NOT NULL "CreatedBy" |
| RouteExpenses_ExpenseDate_not_null | NOT NULL "ExpenseDate" |
| RouteExpenses_Id_not_null | NOT NULL "Id" |
| RouteExpenses_RouteId_not_null | NOT NULL "RouteId" |
| RouteExpenses_TenantId_not_null | NOT NULL "TenantId" |
| RouteExpenses_pkey | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_RouteExpenses_CreatedBy | CREATE INDEX "IX_RouteExpenses_CreatedBy" ON public."RouteExpenses" USING btree ("CreatedBy") |
| IX_RouteExpenses_ExpenseDate | CREATE INDEX "IX_RouteExpenses_ExpenseDate" ON public."RouteExpenses" USING btree ("ExpenseDate") |
| IX_RouteExpenses_RouteId | CREATE INDEX "IX_RouteExpenses_RouteId" ON public."RouteExpenses" USING btree ("RouteId") |
| IX_RouteExpenses_TenantId | CREATE INDEX "IX_RouteExpenses_TenantId" ON public."RouteExpenses" USING btree ("TenantId") |
| RouteExpenses_pkey | CREATE UNIQUE INDEX "RouteExpenses_pkey" ON public."RouteExpenses" USING btree ("Id") |

## RouteStaff

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| RouteId | integer | NO |  | NO |
| UserId | integer | NO |  | NO |
| AssignedAt | timestamp with time zone | NO |  | NO |

| Constraint | Definition |
|---|---|
| FK_RouteStaff_Routes_RouteId | FOREIGN KEY ("RouteId") REFERENCES "Routes"("Id") ON DELETE CASCADE |
| FK_RouteStaff_Users_UserId | FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE |
| RouteStaff_AssignedAt_not_null | NOT NULL "AssignedAt" |
| RouteStaff_Id_not_null | NOT NULL "Id" |
| RouteStaff_RouteId_not_null | NOT NULL "RouteId" |
| RouteStaff_UserId_not_null | NOT NULL "UserId" |
| RouteStaff_pkey | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_RouteStaff_RouteId | CREATE INDEX "IX_RouteStaff_RouteId" ON public."RouteStaff" USING btree ("RouteId") |
| IX_RouteStaff_RouteId_UserId | CREATE UNIQUE INDEX "IX_RouteStaff_RouteId_UserId" ON public."RouteStaff" USING btree ("RouteId", "UserId") |
| IX_RouteStaff_UserId | CREATE INDEX "IX_RouteStaff_UserId" ON public."RouteStaff" USING btree ("UserId") |
| RouteStaff_pkey | CREATE UNIQUE INDEX "RouteStaff_pkey" ON public."RouteStaff" USING btree ("Id") |

## Routes

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| BranchId | integer | NO |  | NO |
| TenantId | integer | NO |  | NO |
| Name | varchar(200) | NO |  | NO |
| AssignedStaffId | integer | YES |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| UpdatedAt | timestamp with time zone | YES |  | NO |
| IsActive | boolean | NO | true | NO |

| Constraint | Definition |
|---|---|
| FK_Routes_Branches_BranchId | FOREIGN KEY ("BranchId") REFERENCES "Branches"("Id") ON DELETE CASCADE |
| FK_Routes_Tenants_TenantId | FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE CASCADE |
| FK_Routes_Users_AssignedStaffId | FOREIGN KEY ("AssignedStaffId") REFERENCES "Users"("Id") ON DELETE SET NULL |
| Routes_BranchId_not_null | NOT NULL "BranchId" |
| Routes_CreatedAt_not_null | NOT NULL "CreatedAt" |
| Routes_Id_not_null | NOT NULL "Id" |
| Routes_IsActive_not_null | NOT NULL "IsActive" |
| Routes_Name_not_null | NOT NULL "Name" |
| Routes_TenantId_not_null | NOT NULL "TenantId" |
| Routes_pkey | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_Routes_AssignedStaffId | CREATE INDEX "IX_Routes_AssignedStaffId" ON public."Routes" USING btree ("AssignedStaffId") |
| IX_Routes_BranchId | CREATE INDEX "IX_Routes_BranchId" ON public."Routes" USING btree ("BranchId") |
| IX_Routes_TenantId | CREATE INDEX "IX_Routes_TenantId" ON public."Routes" USING btree ("TenantId") |
| Routes_pkey | CREATE UNIQUE INDEX "Routes_pkey" ON public."Routes" USING btree ("Id") |

## SalaryCertificates

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO | nextval('"SalaryCertificates_Id_seq"'::regclass) | NO |
| OwnerId | integer | NO |  | NO |
| TenantId | integer | YES |  | NO |
| CertificateNo | varchar(50) | NO |  | NO |
| CertificateDate | timestamp with time zone | NO |  | NO |
| Recipient | varchar(200) | YES |  | NO |
| EmployeeName | varchar(200) | YES |  | NO |
| PassportNumber | varchar(50) | YES |  | NO |
| EmployeeNationality | varchar(100) | YES |  | NO |
| JoiningDate | timestamp with time zone | YES |  | NO |
| Designation | varchar(200) | YES |  | NO |
| MonthlySalary | numeric(18,2) | YES |  | NO |
| MonthlySalaryWords | varchar(200) | YES |  | NO |
| EmployeePhone | varchar(50) | YES |  | NO |
| SignatoryName | varchar(200) | NO | 'Sudheesh Thampi'::character varying | NO |
| SignatoryTitle | varchar(100) | NO | 'Manager'::character varying | NO |
| Status | varchar(20) | NO |  | NO |
| Notes | text | YES |  | NO |
| CreatedBy | integer | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| LastModifiedBy | integer | YES |  | NO |
| LastModifiedAt | timestamp with time zone | YES |  | NO |
| IsDeleted | boolean | NO | false | NO |
| DeletedBy | integer | YES |  | NO |
| DeletedAt | timestamp with time zone | YES |  | NO |

| Constraint | Definition |
|---|---|
| SalaryCertificates_CertificateDate_not_null | NOT NULL "CertificateDate" |
| SalaryCertificates_CertificateNo_not_null | NOT NULL "CertificateNo" |
| SalaryCertificates_CreatedAt_not_null | NOT NULL "CreatedAt" |
| SalaryCertificates_CreatedBy_not_null | NOT NULL "CreatedBy" |
| SalaryCertificates_Id_not_null | NOT NULL "Id" |
| SalaryCertificates_IsDeleted_not_null | NOT NULL "IsDeleted" |
| SalaryCertificates_OwnerId_not_null | NOT NULL "OwnerId" |
| SalaryCertificates_SignatoryName_not_null | NOT NULL "SignatoryName" |
| SalaryCertificates_SignatoryTitle_not_null | NOT NULL "SignatoryTitle" |
| SalaryCertificates_Status_not_null | NOT NULL "Status" |
| SalaryCertificates_pkey | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_SalaryCertificates_TenantId | CREATE INDEX "IX_SalaryCertificates_TenantId" ON public."SalaryCertificates" USING btree ("TenantId") |
| IX_SalaryCertificates_TenantId_CertificateNo | CREATE UNIQUE INDEX "IX_SalaryCertificates_TenantId_CertificateNo" ON public."SalaryCertificates" USING btree ("TenantId", "CertificateNo") WHERE ("IsDeleted" = false) |
| SalaryCertificates_pkey | CREATE UNIQUE INDEX "SalaryCertificates_pkey" ON public."SalaryCertificates" USING btree ("Id") |

## SaleItems

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| SaleId | integer | NO |  | NO |
| ProductId | integer | NO |  | NO |
| UnitType | varchar(20) | NO |  | NO |
| Qty | numeric(18,2) | NO |  | NO |
| UnitPrice | numeric(18,2) | NO |  | NO |
| Discount | numeric(18,2) | NO |  | NO |
| VatAmount | numeric(18,2) | NO |  | NO |
| LineTotal | numeric(18,2) | NO |  | NO |
| VatRate | numeric(18,4) | NO | 0.0 | NO |
| VatScenario | text | YES |  | NO |
| UnitCostAtSale | numeric(18,6) | YES |  | NO |
| ConversionAtSale | numeric(18,6) | YES |  | NO |
| CostCapturedAt | timestamp with time zone | YES |  | NO |

| Constraint | Definition |
|---|---|
| FK_SaleItems_Products_ProductId | FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE |
| FK_SaleItems_Sales_SaleId | FOREIGN KEY ("SaleId") REFERENCES "Sales"("Id") ON DELETE CASCADE |
| PK_SaleItems | PRIMARY KEY ("Id") |
| SaleItems_Discount_not_null | NOT NULL "Discount" |
| SaleItems_Id_not_null | NOT NULL "Id" |
| SaleItems_LineTotal_not_null | NOT NULL "LineTotal" |
| SaleItems_ProductId_not_null | NOT NULL "ProductId" |
| SaleItems_Qty_not_null | NOT NULL "Qty" |
| SaleItems_SaleId_not_null | NOT NULL "SaleId" |
| SaleItems_UnitPrice_not_null | NOT NULL "UnitPrice" |
| SaleItems_UnitType_not_null | NOT NULL "UnitType" |
| SaleItems_VatAmount_not_null | NOT NULL "VatAmount" |
| SaleItems_VatRate_not_null | NOT NULL "VatRate" |

| Index | Definition |
|---|---|
| IX_SaleItems_ProductId | CREATE INDEX "IX_SaleItems_ProductId" ON public."SaleItems" USING btree ("ProductId") |
| IX_SaleItems_SaleId | CREATE INDEX "IX_SaleItems_SaleId" ON public."SaleItems" USING btree ("SaleId") |
| PK_SaleItems | CREATE UNIQUE INDEX "PK_SaleItems" ON public."SaleItems" USING btree ("Id") |

## SaleReturnItems

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| SaleReturnId | integer | NO |  | NO |
| SaleItemId | integer | NO |  | NO |
| ProductId | integer | NO |  | NO |
| UnitType | varchar(20) | NO |  | NO |
| Qty | numeric(18,2) | NO |  | NO |
| UnitPrice | numeric(18,2) | NO |  | NO |
| VatAmount | numeric(18,2) | NO |  | NO |
| LineTotal | numeric(18,2) | NO |  | NO |
| Reason | varchar(200) | YES |  | NO |
| Condition | varchar(20) | YES |  | NO |
| DamageCategoryId | integer | YES |  | NO |
| StockEffect | boolean | YES |  | NO |

| Constraint | Definition |
|---|---|
| FK_SaleReturnItems_Products_ProductId | FOREIGN KEY ("ProductId") REFERENCES "Products"("Id") ON DELETE CASCADE |
| FK_SaleReturnItems_SaleItems_SaleItemId | FOREIGN KEY ("SaleItemId") REFERENCES "SaleItems"("Id") ON DELETE CASCADE |
| FK_SaleReturnItems_SaleReturns_SaleReturnId | FOREIGN KEY ("SaleReturnId") REFERENCES "SaleReturns"("Id") ON DELETE CASCADE |
| PK_SaleReturnItems | PRIMARY KEY ("Id") |
| SaleReturnItems_Id_not_null | NOT NULL "Id" |
| SaleReturnItems_LineTotal_not_null | NOT NULL "LineTotal" |
| SaleReturnItems_ProductId_not_null | NOT NULL "ProductId" |
| SaleReturnItems_Qty_not_null | NOT NULL "Qty" |
| SaleReturnItems_SaleItemId_not_null | NOT NULL "SaleItemId" |
| SaleReturnItems_SaleReturnId_not_null | NOT NULL "SaleReturnId" |
| SaleReturnItems_UnitPrice_not_null | NOT NULL "UnitPrice" |
| SaleReturnItems_UnitType_not_null | NOT NULL "UnitType" |
| SaleReturnItems_VatAmount_not_null | NOT NULL "VatAmount" |

| Index | Definition |
|---|---|
| IX_SaleReturnItems_ProductId | CREATE INDEX "IX_SaleReturnItems_ProductId" ON public."SaleReturnItems" USING btree ("ProductId") |
| IX_SaleReturnItems_SaleItemId | CREATE INDEX "IX_SaleReturnItems_SaleItemId" ON public."SaleReturnItems" USING btree ("SaleItemId") |
| IX_SaleReturnItems_SaleReturnId | CREATE INDEX "IX_SaleReturnItems_SaleReturnId" ON public."SaleReturnItems" USING btree ("SaleReturnId") |
| PK_SaleReturnItems | CREATE UNIQUE INDEX "PK_SaleReturnItems" ON public."SaleReturnItems" USING btree ("Id") |

## SaleReturns

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| OwnerId | integer | NO |  | NO |
| TenantId | integer | YES |  | NO |
| SaleId | integer | NO |  | NO |
| CustomerId | integer | YES |  | NO |
| ReturnNo | varchar(100) | NO |  | NO |
| ReturnDate | timestamp with time zone | NO |  | NO |
| Subtotal | numeric(18,2) | NO |  | NO |
| VatTotal | numeric(18,2) | NO |  | NO |
| Discount | numeric(18,2) | NO |  | NO |
| GrandTotal | numeric(18,2) | NO |  | NO |
| Reason | varchar(500) | YES |  | NO |
| Status | text | NO |  | NO |
| RestoreStock | boolean | NO |  | NO |
| IsBadItem | boolean | NO |  | NO |
| CreatedBy | integer | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| BranchId | integer | YES |  | NO |
| RouteId | integer | YES |  | NO |
| ReturnCategory | varchar(20) | YES |  | NO |
| ReturnType | varchar(20) | YES |  | NO |
| RefundStatus | varchar(20) | YES |  | NO |

| Constraint | Definition |
|---|---|
| FK_SaleReturns_Customers_CustomerId | FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") |
| FK_SaleReturns_Sales_SaleId | FOREIGN KEY ("SaleId") REFERENCES "Sales"("Id") ON DELETE CASCADE |
| FK_SaleReturns_Users_CreatedBy | FOREIGN KEY ("CreatedBy") REFERENCES "Users"("Id") ON DELETE CASCADE |
| PK_SaleReturns | PRIMARY KEY ("Id") |
| SaleReturns_CreatedAt_not_null | NOT NULL "CreatedAt" |
| SaleReturns_CreatedBy_not_null | NOT NULL "CreatedBy" |
| SaleReturns_Discount_not_null | NOT NULL "Discount" |
| SaleReturns_GrandTotal_not_null | NOT NULL "GrandTotal" |
| SaleReturns_Id_not_null | NOT NULL "Id" |
| SaleReturns_IsBadItem_not_null | NOT NULL "IsBadItem" |
| SaleReturns_OwnerId_not_null | NOT NULL "OwnerId" |
| SaleReturns_RestoreStock_not_null | NOT NULL "RestoreStock" |
| SaleReturns_ReturnDate_not_null | NOT NULL "ReturnDate" |
| SaleReturns_ReturnNo_not_null | NOT NULL "ReturnNo" |
| SaleReturns_SaleId_not_null | NOT NULL "SaleId" |
| SaleReturns_Status_not_null | NOT NULL "Status" |
| SaleReturns_Subtotal_not_null | NOT NULL "Subtotal" |
| SaleReturns_VatTotal_not_null | NOT NULL "VatTotal" |

| Index | Definition |
|---|---|
| IX_SaleReturns_CreatedBy | CREATE INDEX "IX_SaleReturns_CreatedBy" ON public."SaleReturns" USING btree ("CreatedBy") |
| IX_SaleReturns_CustomerId | CREATE INDEX "IX_SaleReturns_CustomerId" ON public."SaleReturns" USING btree ("CustomerId") |
| IX_SaleReturns_SaleId | CREATE INDEX "IX_SaleReturns_SaleId" ON public."SaleReturns" USING btree ("SaleId") |
| IX_SaleReturns_TenantId_ReturnNo | CREATE UNIQUE INDEX "IX_SaleReturns_TenantId_ReturnNo" ON public."SaleReturns" USING btree ("TenantId", "ReturnNo") |
| PK_SaleReturns | CREATE UNIQUE INDEX "PK_SaleReturns" ON public."SaleReturns" USING btree ("Id") |

## Sales

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| OwnerId | integer | NO |  | NO |
| TenantId | integer | YES |  | NO |
| InvoiceNo | varchar(100) | NO |  | NO |
| ExternalReference | varchar(200) | YES |  | NO |
| InvoiceDate | timestamp with time zone | NO |  | NO |
| CustomerId | integer | YES |  | NO |
| Subtotal | numeric(18,2) | NO |  | NO |
| VatTotal | numeric(18,2) | NO |  | NO |
| Discount | numeric(18,2) | NO |  | NO |
| GrandTotal | numeric(18,2) | NO |  | NO |
| TotalAmount | numeric(18,2) | NO |  | NO |
| PaidAmount | numeric(18,2) | NO | 0.0 | NO |
| PaymentStatus | text | NO |  | NO |
| LastPaymentDate | timestamp with time zone | YES |  | NO |
| DueDate | timestamp with time zone | YES |  | NO |
| Notes | text | YES |  | NO |
| CreatedBy | integer | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| LastModifiedBy | integer | YES |  | NO |
| LastModifiedAt | timestamp with time zone | YES |  | NO |
| IsDeleted | boolean | NO | false | NO |
| DeletedBy | integer | YES |  | NO |
| DeletedAt | timestamp with time zone | YES |  | NO |
| IsFinalized | boolean | NO |  | NO |
| IsLocked | boolean | NO | false | NO |
| LockedAt | timestamp with time zone | YES |  | NO |
| EditReason | varchar(500) | YES |  | NO |
| Version | integer | NO | 1 | NO |
| RowVersion | bytea | YES | '\x00'::bytea | NO |
| BranchId | integer | YES |  | NO |
| RouteId | integer | YES |  | NO |
| IsZeroInvoice | boolean | NO | false | NO |
| VatScenario | text | YES |  | NO |
| RoundOff | numeric | NO | 0 | NO |

| Constraint | Definition |
|---|---|
| FK_Sales_Branches_BranchId | FOREIGN KEY ("BranchId") REFERENCES "Branches"("Id") ON DELETE SET NULL |
| FK_Sales_Customers_CustomerId | FOREIGN KEY ("CustomerId") REFERENCES "Customers"("Id") |
| FK_Sales_Routes_RouteId | FOREIGN KEY ("RouteId") REFERENCES "Routes"("Id") ON DELETE SET NULL |
| FK_Sales_Users_CreatedBy | FOREIGN KEY ("CreatedBy") REFERENCES "Users"("Id") ON DELETE CASCADE |
| FK_Sales_Users_DeletedBy | FOREIGN KEY ("DeletedBy") REFERENCES "Users"("Id") |
| FK_Sales_Users_LastModifiedBy | FOREIGN KEY ("LastModifiedBy") REFERENCES "Users"("Id") |
| PK_Sales | PRIMARY KEY ("Id") |
| Sales_CreatedAt_not_null | NOT NULL "CreatedAt" |
| Sales_CreatedBy_not_null | NOT NULL "CreatedBy" |
| Sales_Discount_not_null | NOT NULL "Discount" |
| Sales_GrandTotal_not_null | NOT NULL "GrandTotal" |
| Sales_Id_not_null | NOT NULL "Id" |
| Sales_InvoiceDate_not_null | NOT NULL "InvoiceDate" |
| Sales_InvoiceNo_not_null | NOT NULL "InvoiceNo" |
| Sales_IsDeleted_not_null | NOT NULL "IsDeleted" |
| Sales_IsFinalized_not_null | NOT NULL "IsFinalized" |
| Sales_IsLocked_not_null | NOT NULL "IsLocked" |
| Sales_IsZeroInvoice_not_null | NOT NULL "IsZeroInvoice" |
| Sales_OwnerId_not_null | NOT NULL "OwnerId" |
| Sales_PaidAmount_not_null | NOT NULL "PaidAmount" |
| Sales_PaymentStatus_not_null | NOT NULL "PaymentStatus" |
| Sales_RoundOff_not_null | NOT NULL "RoundOff" |
| Sales_Subtotal_not_null | NOT NULL "Subtotal" |
| Sales_TotalAmount_not_null | NOT NULL "TotalAmount" |
| Sales_VatTotal_not_null | NOT NULL "VatTotal" |
| Sales_Version_not_null | NOT NULL "Version" |

| Index | Definition |
|---|---|
| IX_Sales_BranchId | CREATE INDEX "IX_Sales_BranchId" ON public."Sales" USING btree ("BranchId") |
| IX_Sales_CreatedAt | CREATE INDEX "IX_Sales_CreatedAt" ON public."Sales" USING btree ("CreatedAt") |
| IX_Sales_CreatedBy | CREATE INDEX "IX_Sales_CreatedBy" ON public."Sales" USING btree ("CreatedBy") |
| IX_Sales_CustomerId | CREATE INDEX "IX_Sales_CustomerId" ON public."Sales" USING btree ("CustomerId") |
| IX_Sales_DeletedBy | CREATE INDEX "IX_Sales_DeletedBy" ON public."Sales" USING btree ("DeletedBy") |
| IX_Sales_ExternalReference | CREATE UNIQUE INDEX "IX_Sales_ExternalReference" ON public."Sales" USING btree ("ExternalReference") WHERE ("ExternalReference" IS NOT NULL) |
| IX_Sales_IsLocked | CREATE INDEX "IX_Sales_IsLocked" ON public."Sales" USING btree ("IsLocked") |
| IX_Sales_LastModifiedBy | CREATE INDEX "IX_Sales_LastModifiedBy" ON public."Sales" USING btree ("LastModifiedBy") |
| IX_Sales_OwnerId_InvoiceNo | CREATE UNIQUE INDEX "IX_Sales_OwnerId_InvoiceNo" ON public."Sales" USING btree ("OwnerId", "InvoiceNo") WHERE ("IsDeleted" = false) |
| IX_Sales_RouteId | CREATE INDEX "IX_Sales_RouteId" ON public."Sales" USING btree ("RouteId") |
| IX_Sales_TenantId_CustomerId | CREATE INDEX "IX_Sales_TenantId_CustomerId" ON public."Sales" USING btree ("TenantId", "CustomerId") WHERE ("CustomerId" IS NOT NULL) |
| IX_Sales_TenantId_InvoiceDate_IsDeleted | CREATE INDEX "IX_Sales_TenantId_InvoiceDate_IsDeleted" ON public."Sales" USING btree ("TenantId", "InvoiceDate" DESC, "IsDeleted") WHERE ("IsDeleted" = false) |
| IX_Sales_TenantId_PaymentStatus | CREATE INDEX "IX_Sales_TenantId_PaymentStatus" ON public."Sales" USING btree ("TenantId", "PaymentStatus") |
| IX_Sales_TenantId_RouteId | CREATE INDEX "IX_Sales_TenantId_RouteId" ON public."Sales" USING btree ("TenantId", "RouteId") WHERE ("RouteId" IS NOT NULL) |
| PK_Sales | CREATE UNIQUE INDEX "PK_Sales" ON public."Sales" USING btree ("Id") |
| idx_sales_tenant_deleted | CREATE INDEX idx_sales_tenant_deleted ON public."Sales" USING btree ("TenantId", "IsDeleted") |
| idx_sales_tenant_invoicedate | CREATE INDEX idx_sales_tenant_invoicedate ON public."Sales" USING btree ("TenantId", "InvoiceDate" DESC) |

## Settings

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Key | varchar(100) | NO |  | NO |
| OwnerId | integer | NO |  | NO |
| TenantId | integer | YES |  | NO |
| Value | text | YES |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| UpdatedAt | timestamp with time zone | NO |  | NO |

| Constraint | Definition |
|---|---|
| FK_Settings_Tenants_TenantId | FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") |
| PK_Settings | PRIMARY KEY ("Key", "OwnerId") |
| Settings_CreatedAt_not_null | NOT NULL "CreatedAt" |
| Settings_Key_not_null | NOT NULL "Key" |
| Settings_OwnerId_not_null | NOT NULL "OwnerId" |
| Settings_UpdatedAt_not_null | NOT NULL "UpdatedAt" |

| Index | Definition |
|---|---|
| IX_Settings_OwnerId | CREATE INDEX "IX_Settings_OwnerId" ON public."Settings" USING btree ("OwnerId") |
| IX_Settings_TenantId | CREATE INDEX "IX_Settings_TenantId" ON public."Settings" USING btree ("TenantId") |
| PK_Settings | CREATE UNIQUE INDEX "PK_Settings" ON public."Settings" USING btree ("Key", "OwnerId") |

## SubscriptionPlans

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| Name | varchar(100) | NO |  | NO |
| Description | varchar(500) | YES |  | NO |
| MonthlyPrice | numeric | NO |  | NO |
| YearlyPrice | numeric | NO |  | NO |
| Currency | text | NO |  | NO |
| MaxUsers | integer | NO |  | NO |
| MaxInvoicesPerMonth | integer | NO |  | NO |
| MaxCustomers | integer | NO |  | NO |
| MaxProducts | integer | NO |  | NO |
| MaxStorageMB | bigint | NO |  | NO |
| HasAdvancedReports | boolean | NO |  | NO |
| HasApiAccess | boolean | NO |  | NO |
| HasWhiteLabel | boolean | NO |  | NO |
| HasPrioritySupport | boolean | NO |  | NO |
| HasCustomBranding | boolean | NO |  | NO |
| TrialDays | integer | NO |  | NO |
| IsActive | boolean | NO |  | NO |
| DisplayOrder | integer | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| UpdatedAt | timestamp with time zone | YES |  | NO |

| Constraint | Definition |
|---|---|
| PK_SubscriptionPlans | PRIMARY KEY ("Id") |
| SubscriptionPlans_CreatedAt_not_null | NOT NULL "CreatedAt" |
| SubscriptionPlans_Currency_not_null | NOT NULL "Currency" |
| SubscriptionPlans_DisplayOrder_not_null | NOT NULL "DisplayOrder" |
| SubscriptionPlans_HasAdvancedReports_not_null | NOT NULL "HasAdvancedReports" |
| SubscriptionPlans_HasApiAccess_not_null | NOT NULL "HasApiAccess" |
| SubscriptionPlans_HasCustomBranding_not_null | NOT NULL "HasCustomBranding" |
| SubscriptionPlans_HasPrioritySupport_not_null | NOT NULL "HasPrioritySupport" |
| SubscriptionPlans_HasWhiteLabel_not_null | NOT NULL "HasWhiteLabel" |
| SubscriptionPlans_Id_not_null | NOT NULL "Id" |
| SubscriptionPlans_IsActive_not_null | NOT NULL "IsActive" |
| SubscriptionPlans_MaxCustomers_not_null | NOT NULL "MaxCustomers" |
| SubscriptionPlans_MaxInvoicesPerMonth_not_null | NOT NULL "MaxInvoicesPerMonth" |
| SubscriptionPlans_MaxProducts_not_null | NOT NULL "MaxProducts" |
| SubscriptionPlans_MaxStorageMB_not_null | NOT NULL "MaxStorageMB" |
| SubscriptionPlans_MaxUsers_not_null | NOT NULL "MaxUsers" |
| SubscriptionPlans_MonthlyPrice_not_null | NOT NULL "MonthlyPrice" |
| SubscriptionPlans_Name_not_null | NOT NULL "Name" |
| SubscriptionPlans_TrialDays_not_null | NOT NULL "TrialDays" |
| SubscriptionPlans_YearlyPrice_not_null | NOT NULL "YearlyPrice" |

| Index | Definition |
|---|---|
| PK_SubscriptionPlans | CREATE UNIQUE INDEX "PK_SubscriptionPlans" ON public."SubscriptionPlans" USING btree ("Id") |

## Subscriptions

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| TenantId | integer | NO |  | NO |
| PlanId | integer | NO |  | NO |
| Status | integer | NO |  | NO |
| BillingCycle | integer | NO |  | NO |
| StartDate | timestamp with time zone | NO |  | NO |
| EndDate | timestamp with time zone | YES |  | NO |
| TrialEndDate | timestamp with time zone | YES |  | NO |
| CancelledAt | timestamp with time zone | YES |  | NO |
| CancellationReason | varchar(500) | YES |  | NO |
| ExpiresAt | timestamp with time zone | YES |  | NO |
| NextBillingDate | timestamp with time zone | YES |  | NO |
| Amount | numeric(18,2) | NO |  | NO |
| Currency | varchar(10) | NO |  | NO |
| PaymentGatewaySubscriptionId | varchar(200) | YES |  | NO |
| PaymentGatewayCustomerId | varchar(200) | YES |  | NO |
| PaymentMethod | varchar(50) | YES |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| UpdatedAt | timestamp with time zone | YES |  | NO |

| Constraint | Definition |
|---|---|
| FK_Subscriptions_SubscriptionPlans_PlanId | FOREIGN KEY ("PlanId") REFERENCES "SubscriptionPlans"("Id") ON DELETE CASCADE |
| FK_Subscriptions_Tenants_TenantId | FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE CASCADE |
| PK_Subscriptions | PRIMARY KEY ("Id") |
| Subscriptions_Amount_not_null | NOT NULL "Amount" |
| Subscriptions_BillingCycle_not_null | NOT NULL "BillingCycle" |
| Subscriptions_CreatedAt_not_null | NOT NULL "CreatedAt" |
| Subscriptions_Currency_not_null | NOT NULL "Currency" |
| Subscriptions_Id_not_null | NOT NULL "Id" |
| Subscriptions_PlanId_not_null | NOT NULL "PlanId" |
| Subscriptions_StartDate_not_null | NOT NULL "StartDate" |
| Subscriptions_Status_not_null | NOT NULL "Status" |
| Subscriptions_TenantId_not_null | NOT NULL "TenantId" |

| Index | Definition |
|---|---|
| IX_Subscriptions_PlanId | CREATE INDEX "IX_Subscriptions_PlanId" ON public."Subscriptions" USING btree ("PlanId") |
| IX_Subscriptions_TenantId | CREATE INDEX "IX_Subscriptions_TenantId" ON public."Subscriptions" USING btree ("TenantId") |
| PK_Subscriptions | CREATE UNIQUE INDEX "PK_Subscriptions" ON public."Subscriptions" USING btree ("Id") |

## SupplierCategories

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO | nextval('"SupplierCategories_Id_seq"'::regclass) | NO |
| TenantId | integer | YES |  | NO |
| Name | varchar(100) | NO |  | NO |
| IsActive | boolean | NO | true | NO |
| CreatedAt | timestamp with time zone | NO | (now() AT TIME ZONE 'utc'::text) | NO |

| Constraint | Definition |
|---|---|
| SupplierCategories_CreatedAt_not_null | NOT NULL "CreatedAt" |
| SupplierCategories_Id_not_null | NOT NULL "Id" |
| SupplierCategories_IsActive_not_null | NOT NULL "IsActive" |
| SupplierCategories_Name_not_null | NOT NULL "Name" |
| SupplierCategories_pkey | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_SupplierCategories_TenantId_Name | CREATE UNIQUE INDEX "IX_SupplierCategories_TenantId_Name" ON public."SupplierCategories" USING btree ("TenantId", "Name") |
| SupplierCategories_pkey | CREATE UNIQUE INDEX "SupplierCategories_pkey" ON public."SupplierCategories" USING btree ("Id") |

## SupplierLedgerCredits

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO | nextval('"SupplierLedgerCredits_Id_seq"'::regclass) | NO |
| TenantId | integer | NO |  | NO |
| SupplierName | varchar(200) | NO |  | NO |
| Amount | numeric(18,2) | NO |  | NO |
| CreditDate | timestamp with time zone | NO |  | NO |
| CreditType | varchar(50) | NO |  | NO |
| Notes | varchar(500) | YES |  | NO |
| CreatedBy | integer | NO |  | NO |
| CreatedAt | timestamp with time zone | NO | (now() AT TIME ZONE 'utc'::text) | NO |

| Constraint | Definition |
|---|---|
| SupplierLedgerCredits_Amount_not_null | NOT NULL "Amount" |
| SupplierLedgerCredits_CreatedAt_not_null | NOT NULL "CreatedAt" |
| SupplierLedgerCredits_CreatedBy_not_null | NOT NULL "CreatedBy" |
| SupplierLedgerCredits_CreditDate_not_null | NOT NULL "CreditDate" |
| SupplierLedgerCredits_CreditType_not_null | NOT NULL "CreditType" |
| SupplierLedgerCredits_Id_not_null | NOT NULL "Id" |
| SupplierLedgerCredits_SupplierName_not_null | NOT NULL "SupplierName" |
| SupplierLedgerCredits_TenantId_not_null | NOT NULL "TenantId" |
| SupplierLedgerCredits_pkey | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_SupplierLedgerCredits_CreditDate | CREATE INDEX "IX_SupplierLedgerCredits_CreditDate" ON public."SupplierLedgerCredits" USING btree ("CreditDate") |
| IX_SupplierLedgerCredits_TenantId_SupplierName | CREATE INDEX "IX_SupplierLedgerCredits_TenantId_SupplierName" ON public."SupplierLedgerCredits" USING btree ("TenantId", "SupplierName") |
| SupplierLedgerCredits_pkey | CREATE UNIQUE INDEX "SupplierLedgerCredits_pkey" ON public."SupplierLedgerCredits" USING btree ("Id") |

## SupplierPayments

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO | nextval('"SupplierPayments_Id_seq"'::regclass) | NO |
| TenantId | integer | YES |  | NO |
| SupplierId | integer | YES |  | NO |
| Amount | numeric(18,2) | NO |  | NO |
| PaymentDate | timestamp with time zone | NO |  | NO |
| Reference | varchar(200) | YES |  | NO |
| PurchaseId | integer | YES |  | NO |
| CreatedAt | timestamp with time zone | NO | (now() AT TIME ZONE 'utc'::text) | NO |
| SupplierName | varchar(200) | YES |  | NO |
| Mode | varchar(20) | YES |  | NO |
| Notes | varchar(500) | YES |  | NO |
| CreatedBy | integer | NO | 1 | NO |

| Constraint | Definition |
|---|---|
| FK_SupplierPayments_Purchases_PurchaseId | FOREIGN KEY ("PurchaseId") REFERENCES "Purchases"("Id") ON DELETE SET NULL |
| FK_SupplierPayments_Suppliers_SupplierId | FOREIGN KEY ("SupplierId") REFERENCES "Suppliers"("Id") ON DELETE RESTRICT |
| SupplierPayments_Amount_not_null | NOT NULL "Amount" |
| SupplierPayments_CreatedAt_not_null | NOT NULL "CreatedAt" |
| SupplierPayments_CreatedBy_not_null | NOT NULL "CreatedBy" |
| SupplierPayments_Id_not_null | NOT NULL "Id" |
| SupplierPayments_PaymentDate_not_null | NOT NULL "PaymentDate" |
| SupplierPayments_pkey | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_SupplierPayments_PaymentDate | CREATE INDEX "IX_SupplierPayments_PaymentDate" ON public."SupplierPayments" USING btree ("PaymentDate") |
| IX_SupplierPayments_PurchaseId | CREATE INDEX "IX_SupplierPayments_PurchaseId" ON public."SupplierPayments" USING btree ("PurchaseId") |
| IX_SupplierPayments_SupplierId | CREATE INDEX "IX_SupplierPayments_SupplierId" ON public."SupplierPayments" USING btree ("SupplierId") |
| SupplierPayments_pkey | CREATE UNIQUE INDEX "SupplierPayments_pkey" ON public."SupplierPayments" USING btree ("Id") |

## Suppliers

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO | nextval('"Suppliers_Id_seq"'::regclass) | NO |
| TenantId | integer | YES |  | NO |
| Name | varchar(200) | NO |  | NO |
| NormalizedName | varchar(200) | NO |  | NO |
| Phone | varchar(50) | YES |  | NO |
| Address | varchar(500) | YES |  | NO |
| CategoryId | integer | YES |  | NO |
| OpeningBalance | numeric(18,2) | NO | 0 | NO |
| IsActive | boolean | NO | true | NO |
| CreatedAt | timestamp with time zone | NO | (now() AT TIME ZONE 'utc'::text) | NO |
| UpdatedAt | timestamp with time zone | YES |  | NO |
| Email | varchar(200) | YES |  | NO |
| CreditLimit | numeric(18,2) | NO | 0 | NO |
| PaymentTerms | varchar(100) | YES |  | NO |
| SupplierCategoryId | integer | YES |  | NO |

| Constraint | Definition |
|---|---|
| FK_Suppliers_SupplierCategories_CategoryId | FOREIGN KEY ("CategoryId") REFERENCES "SupplierCategories"("Id") ON DELETE SET NULL |
| Suppliers_CreatedAt_not_null | NOT NULL "CreatedAt" |
| Suppliers_CreditLimit_not_null | NOT NULL "CreditLimit" |
| Suppliers_Id_not_null | NOT NULL "Id" |
| Suppliers_IsActive_not_null | NOT NULL "IsActive" |
| Suppliers_Name_not_null | NOT NULL "Name" |
| Suppliers_NormalizedName_not_null | NOT NULL "NormalizedName" |
| Suppliers_OpeningBalance_not_null | NOT NULL "OpeningBalance" |
| Suppliers_pkey | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_Suppliers_CategoryId | CREATE INDEX "IX_Suppliers_CategoryId" ON public."Suppliers" USING btree ("CategoryId") |
| IX_Suppliers_TenantId_NormalizedName | CREATE UNIQUE INDEX "IX_Suppliers_TenantId_NormalizedName" ON public."Suppliers" USING btree ("TenantId", "NormalizedName") |
| Suppliers_pkey | CREATE UNIQUE INDEX "Suppliers_pkey" ON public."Suppliers" USING btree ("Id") |

## SupportSessions

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| TenantId | integer | NO |  | NO |
| PlatformUserId | integer | NO |  | NO |
| Reason | varchar(500) | NO |  | NO |
| StartedAt | timestamp with time zone | NO |  | NO |
| ExpiresAt | timestamp with time zone | NO |  | NO |
| EndedAt | timestamp with time zone | YES |  | NO |
| ReadOnly | boolean | NO |  | NO |

| Constraint | Definition |
|---|---|
| FK_SupportSessions_Tenants_TenantId | FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE CASCADE |
| FK_SupportSessions_Users_PlatformUserId | FOREIGN KEY ("PlatformUserId") REFERENCES "Users"("Id") ON DELETE RESTRICT |
| SupportSessions_ExpiresAt_not_null | NOT NULL "ExpiresAt" |
| SupportSessions_Id_not_null | NOT NULL "Id" |
| SupportSessions_PlatformUserId_not_null | NOT NULL "PlatformUserId" |
| SupportSessions_ReadOnly_not_null | NOT NULL "ReadOnly" |
| SupportSessions_Reason_not_null | NOT NULL "Reason" |
| SupportSessions_StartedAt_not_null | NOT NULL "StartedAt" |
| SupportSessions_TenantId_not_null | NOT NULL "TenantId" |
| SupportSessions_pkey | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_SupportSessions_TenantId_PlatformUserId_ExpiresAt | CREATE INDEX "IX_SupportSessions_TenantId_PlatformUserId_ExpiresAt" ON public."SupportSessions" USING btree ("TenantId", "PlatformUserId", "ExpiresAt") |
| SupportSessions_pkey | CREATE UNIQUE INDEX "SupportSessions_pkey" ON public."SupportSessions" USING btree ("Id") |

## TenantDocumentVersions

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | uuid | NO |  | NO |
| TenantId | integer | NO |  | NO |
| DocumentId | uuid | NO |  | NO |
| VersionNumber | integer | NO |  | NO |
| OriginalFileName | varchar(200) | NO |  | NO |
| ContentType | varchar(100) | NO |  | NO |
| SizeBytes | bigint | NO |  | NO |
| Sha256 | varchar(64) | NO |  | NO |
| StorageKey | varchar(300) | NO |  | NO |
| Status | varchar(20) | NO |  | NO |
| ExpiresOn | timestamp with time zone | YES |  | NO |
| UploadedByUserId | integer | NO |  | NO |
| UploadedAt | timestamp with time zone | NO |  | NO |
| ReviewedByUserId | integer | YES |  | NO |
| ReviewedAt | timestamp with time zone | YES |  | NO |

| Constraint | Definition |
|---|---|
| PK_TenantDocumentVersions | PRIMARY KEY ("Id") |
| TenantDocumentVersions_ContentType_not_null | NOT NULL "ContentType" |
| TenantDocumentVersions_DocumentId_not_null | NOT NULL "DocumentId" |
| TenantDocumentVersions_Id_not_null | NOT NULL "Id" |
| TenantDocumentVersions_OriginalFileName_not_null | NOT NULL "OriginalFileName" |
| TenantDocumentVersions_Sha256_not_null | NOT NULL "Sha256" |
| TenantDocumentVersions_SizeBytes_not_null | NOT NULL "SizeBytes" |
| TenantDocumentVersions_Status_not_null | NOT NULL "Status" |
| TenantDocumentVersions_StorageKey_not_null | NOT NULL "StorageKey" |
| TenantDocumentVersions_TenantId_not_null | NOT NULL "TenantId" |
| TenantDocumentVersions_UploadedAt_not_null | NOT NULL "UploadedAt" |
| TenantDocumentVersions_UploadedByUserId_not_null | NOT NULL "UploadedByUserId" |
| TenantDocumentVersions_VersionNumber_not_null | NOT NULL "VersionNumber" |

| Index | Definition |
|---|---|
| IX_TenantDocumentVersions_TenantId_DocumentId_VersionNumber | CREATE UNIQUE INDEX "IX_TenantDocumentVersions_TenantId_DocumentId_VersionNumber" ON public."TenantDocumentVersions" USING btree ("TenantId", "DocumentId", "VersionNumber") |
| PK_TenantDocumentVersions | CREATE UNIQUE INDEX "PK_TenantDocumentVersions" ON public."TenantDocumentVersions" USING btree ("Id") |

## TenantDocuments

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | uuid | NO |  | NO |
| TenantId | integer | NO |  | NO |
| Title | varchar(200) | NO |  | NO |
| DocType | varchar(20) | NO |  | NO |
| Visibility | varchar(20) | NO |  | NO |
| Status | varchar(20) | NO |  | NO |
| CurrentVersionId | uuid | YES |  | NO |
| CreatedByUserId | integer | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| UpdatedAt | timestamp with time zone | NO |  | NO |
| DeletedAt | timestamp with time zone | YES |  | NO |

| Constraint | Definition |
|---|---|
| PK_TenantDocuments | PRIMARY KEY ("Id") |
| TenantDocuments_CreatedAt_not_null | NOT NULL "CreatedAt" |
| TenantDocuments_CreatedByUserId_not_null | NOT NULL "CreatedByUserId" |
| TenantDocuments_DocType_not_null | NOT NULL "DocType" |
| TenantDocuments_Id_not_null | NOT NULL "Id" |
| TenantDocuments_Status_not_null | NOT NULL "Status" |
| TenantDocuments_TenantId_not_null | NOT NULL "TenantId" |
| TenantDocuments_Title_not_null | NOT NULL "Title" |
| TenantDocuments_UpdatedAt_not_null | NOT NULL "UpdatedAt" |
| TenantDocuments_Visibility_not_null | NOT NULL "Visibility" |

| Index | Definition |
|---|---|
| IX_TenantDocuments_TenantId_Status | CREATE INDEX "IX_TenantDocuments_TenantId_Status" ON public."TenantDocuments" USING btree ("TenantId", "Status") |
| PK_TenantDocuments | CREATE UNIQUE INDEX "PK_TenantDocuments" ON public."TenantDocuments" USING btree ("Id") |

## TenantInvites

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| TenantId | integer | NO |  | NO |
| UserId | integer | NO |  | NO |
| TokenHash | varchar(128) | NO |  | NO |
| HostSubdomain | varchar(30) | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| ExpiresAt | timestamp with time zone | NO |  | NO |
| UsedAt | timestamp with time zone | YES |  | NO |
| RevokedAt | timestamp with time zone | YES |  | NO |
| CreatedByUserId | integer | NO |  | NO |

| Constraint | Definition |
|---|---|
| FK_TenantInvites_Tenants_TenantId | FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE CASCADE |
| FK_TenantInvites_Users_UserId | FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE |
| TenantInvites_CreatedAt_not_null | NOT NULL "CreatedAt" |
| TenantInvites_CreatedByUserId_not_null | NOT NULL "CreatedByUserId" |
| TenantInvites_ExpiresAt_not_null | NOT NULL "ExpiresAt" |
| TenantInvites_HostSubdomain_not_null | NOT NULL "HostSubdomain" |
| TenantInvites_Id_not_null | NOT NULL "Id" |
| TenantInvites_TenantId_not_null | NOT NULL "TenantId" |
| TenantInvites_TokenHash_not_null | NOT NULL "TokenHash" |
| TenantInvites_UserId_not_null | NOT NULL "UserId" |
| TenantInvites_pkey | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_TenantInvites_TenantId_UserId_ExpiresAt | CREATE INDEX "IX_TenantInvites_TenantId_UserId_ExpiresAt" ON public."TenantInvites" USING btree ("TenantId", "UserId", "ExpiresAt") |
| IX_TenantInvites_TokenHash | CREATE UNIQUE INDEX "IX_TenantInvites_TokenHash" ON public."TenantInvites" USING btree ("TokenHash") |
| TenantInvites_pkey | CREATE UNIQUE INDEX "TenantInvites_pkey" ON public."TenantInvites" USING btree ("Id") |

## TenantVatBasisHistory

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| TenantId | integer | NO |  | NO |
| Basis | varchar(20) | NO |  | NO |
| EffectiveFrom | timestamp with time zone | NO |  | NO |
| SetByUserId | integer | NO |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |

| Constraint | Definition |
|---|---|
| FK_TenantVatBasisHistory_Tenants_TenantId | FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") ON DELETE RESTRICT |
| FK_TenantVatBasisHistory_Users_SetByUserId | FOREIGN KEY ("SetByUserId") REFERENCES "Users"("Id") ON DELETE RESTRICT |
| PK_TenantVatBasisHistory | PRIMARY KEY ("Id") |
| TenantVatBasisHistory_Basis_not_null | NOT NULL "Basis" |
| TenantVatBasisHistory_CreatedAt_not_null | NOT NULL "CreatedAt" |
| TenantVatBasisHistory_EffectiveFrom_not_null | NOT NULL "EffectiveFrom" |
| TenantVatBasisHistory_Id_not_null | NOT NULL "Id" |
| TenantVatBasisHistory_SetByUserId_not_null | NOT NULL "SetByUserId" |
| TenantVatBasisHistory_TenantId_not_null | NOT NULL "TenantId" |

| Index | Definition |
|---|---|
| IX_TenantVatBasisHistory_SetByUserId | CREATE INDEX "IX_TenantVatBasisHistory_SetByUserId" ON public."TenantVatBasisHistory" USING btree ("SetByUserId") |
| IX_TenantVatBasisHistory_TenantId_EffectiveFrom | CREATE INDEX "IX_TenantVatBasisHistory_TenantId_EffectiveFrom" ON public."TenantVatBasisHistory" USING btree ("TenantId", "EffectiveFrom") |
| PK_TenantVatBasisHistory | CREATE UNIQUE INDEX "PK_TenantVatBasisHistory" ON public."TenantVatBasisHistory" USING btree ("Id") |

## Tenants

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| Name | varchar(200) | NO |  | NO |
| Subdomain | varchar(100) | NO |  | NO |
| Domain | varchar(200) | YES |  | NO |
| Country | varchar(10) | NO | 'AE'::character varying | NO |
| Currency | varchar(10) | NO | 'AED'::character varying | NO |
| VatNumber | varchar(50) | YES |  | NO |
| CompanyNameEn | varchar(200) | YES |  | NO |
| CompanyNameAr | varchar(200) | YES |  | NO |
| Address | varchar(500) | YES |  | NO |
| Phone | varchar(20) | YES |  | NO |
| Email | varchar(100) | YES |  | NO |
| LogoPath | varchar(500) | YES |  | NO |
| Status | text | NO | 'Active'::text | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| TrialEndDate | timestamp with time zone | YES |  | NO |
| SuspendedAt | timestamp with time zone | YES |  | NO |
| SuspensionReason | varchar(500) | YES |  | NO |
| FeaturesJson | varchar(2000) | YES |  | NO |
| VatCalculationBasis | varchar(20) | NO | 'SalesBased'::character varying | NO |

| Constraint | Definition |
|---|---|
| PK_Tenants | PRIMARY KEY ("Id") |
| Tenants_Country_not_null | NOT NULL "Country" |
| Tenants_CreatedAt_not_null | NOT NULL "CreatedAt" |
| Tenants_Currency_not_null | NOT NULL "Currency" |
| Tenants_Id_not_null | NOT NULL "Id" |
| Tenants_Name_not_null | NOT NULL "Name" |
| Tenants_Status_not_null | NOT NULL "Status" |
| Tenants_Subdomain_not_null | NOT NULL "Subdomain" |
| Tenants_VatCalculationBasis_not_null | NOT NULL "VatCalculationBasis" |

| Index | Definition |
|---|---|
| IX_Tenants_Domain | CREATE UNIQUE INDEX "IX_Tenants_Domain" ON public."Tenants" USING btree ("Domain") WHERE ("Domain" IS NOT NULL) |
| IX_Tenants_Subdomain | CREATE UNIQUE INDEX "IX_Tenants_Subdomain" ON public."Tenants" USING btree ("Subdomain") |
| PK_Tenants | CREATE UNIQUE INDEX "PK_Tenants" ON public."Tenants" USING btree ("Id") |

## UserSessions

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO | nextval('"UserSessions_Id_seq"'::regclass) | NO |
| UserId | integer | NO |  | NO |
| TenantId | integer | NO |  | NO |
| LoginAt | timestamp with time zone | NO |  | NO |
| UserAgent | varchar(500) | YES |  | NO |
| IpAddress | varchar(45) | YES |  | NO |

| Constraint | Definition |
|---|---|
| FK_UserSessions_Users_UserId | FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE |
| UserSessions_Id_not_null | NOT NULL "Id" |
| UserSessions_LoginAt_not_null | NOT NULL "LoginAt" |
| UserSessions_TenantId_not_null | NOT NULL "TenantId" |
| UserSessions_UserId_not_null | NOT NULL "UserId" |
| UserSessions_pkey | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_UserSessions_LoginAt | CREATE INDEX "IX_UserSessions_LoginAt" ON public."UserSessions" USING btree ("LoginAt") |
| IX_UserSessions_TenantId | CREATE INDEX "IX_UserSessions_TenantId" ON public."UserSessions" USING btree ("TenantId") |
| UserSessions_pkey | CREATE UNIQUE INDEX "UserSessions_pkey" ON public."UserSessions" USING btree ("Id") |

## Users

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| Name | varchar(100) | NO |  | NO |
| Email | varchar(100) | NO |  | NO |
| PasswordHash | text | NO |  | NO |
| Role | text | NO |  | NO |
| OwnerId | integer | YES |  | NO |
| TenantId | integer | YES |  | NO |
| Phone | varchar(20) | YES |  | NO |
| DashboardPermissions | text | YES |  | NO |
| CreatedAt | timestamp with time zone | NO |  | NO |
| SessionVersion | integer | NO | 0 | NO |
| ProfilePhotoUrl | varchar(500) | YES |  | NO |
| LanguagePreference | varchar(10) | YES |  | NO |
| LastLoginAt | timestamp with time zone | YES |  | NO |
| LastActiveAt | timestamp with time zone | YES |  | NO |
| PageAccess | varchar(500) | YES |  | NO |
| IsPlatformAdmin | boolean | NO | false | NO |
| IsActive | boolean | NO | true | NO |
| MustChangePassword | boolean | NO | false | NO |

| Constraint | Definition |
|---|---|
| CK_Users_PlatformTenantIdentity | CHECK (((("IsPlatformAdmin" = true) AND ("TenantId" IS NULL)) OR (("IsPlatformAdmin" = false) AND ("TenantId" IS NOT NULL)))) |
| FK_Users_Tenants_TenantId | FOREIGN KEY ("TenantId") REFERENCES "Tenants"("Id") |
| PK_Users | PRIMARY KEY ("Id") |
| Users_CreatedAt_not_null | NOT NULL "CreatedAt" |
| Users_Email_not_null | NOT NULL "Email" |
| Users_Id_not_null | NOT NULL "Id" |
| Users_IsActive_not_null | NOT NULL "IsActive" |
| Users_IsPlatformAdmin_not_null | NOT NULL "IsPlatformAdmin" |
| Users_MustChangePassword_not_null | NOT NULL "MustChangePassword" |
| Users_Name_not_null | NOT NULL "Name" |
| Users_PasswordHash_not_null | NOT NULL "PasswordHash" |
| Users_Role_not_null | NOT NULL "Role" |
| Users_SessionVersion_not_null | NOT NULL "SessionVersion" |

| Index | Definition |
|---|---|
| IX_Users_TenantId | CREATE INDEX "IX_Users_TenantId" ON public."Users" USING btree ("TenantId") |
| IX_Users_TenantId_Email | CREATE UNIQUE INDEX "IX_Users_TenantId_Email" ON public."Users" USING btree ("TenantId", "Email") |
| PK_Users | CREATE UNIQUE INDEX "PK_Users" ON public."Users" USING btree ("Id") |
| idx_users_ownerid | CREATE INDEX idx_users_ownerid ON public."Users" USING btree ("OwnerId") WHERE ("OwnerId" IS NOT NULL) |

## VatReturnPeriods

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO |  | YES |
| TenantId | integer | NO |  | NO |
| PeriodType | text | NO |  | NO |
| PeriodLabel | text | NO |  | NO |
| PeriodStart | timestamp with time zone | NO |  | NO |
| PeriodEnd | timestamp with time zone | NO |  | NO |
| DueDate | timestamp with time zone | NO |  | NO |
| Status | text | NO |  | NO |
| Box1a | numeric(18,4) | NO |  | NO |
| Box1b | numeric(18,4) | NO |  | NO |
| Box2 | numeric(18,4) | NO |  | NO |
| Box3 | numeric(18,4) | NO |  | NO |
| Box4 | numeric(18,4) | NO |  | NO |
| Box9b | numeric(18,4) | NO |  | NO |
| Box10 | numeric(18,4) | NO |  | NO |
| Box11 | numeric(18,4) | NO |  | NO |
| Box12 | numeric(18,4) | NO |  | NO |
| Box13a | numeric(18,4) | NO |  | NO |
| Box13b | numeric(18,4) | NO |  | NO |
| PetroleumExcluded | numeric(18,4) | NO |  | NO |
| CalculatedAt | timestamp with time zone | YES |  | NO |
| SubmittedAt | timestamp with time zone | YES |  | NO |
| SubmittedByUserId | integer | YES |  | NO |
| LockedAt | timestamp with time zone | YES |  | NO |
| LockedByUserId | integer | YES |  | NO |
| Notes | text | YES |  | NO |
| SnapshotJson | text | YES |  | NO |
| SnapshotHash | text | YES |  | NO |
| SnapshotHistoryJson | text | YES |  | NO |
| SnapshotVersion | integer | NO | 0 | NO |
| SnapshotAt | timestamp with time zone | YES |  | NO |
| CalculationVersion | integer | NO | 0 | NO |
| SourceFingerprint | text | YES |  | NO |
| ReviewedAt | timestamp with time zone | YES |  | NO |
| ReviewedByUserId | integer | YES |  | NO |
| ReviewedCalculationVersion | integer | YES |  | NO |
| ReviewInvalidatedAt | timestamp with time zone | YES |  | NO |
| ReviewInvalidatedReason | text | YES |  | NO |

| Constraint | Definition |
|---|---|
| PK_VatReturnPeriods | PRIMARY KEY ("Id") |
| VatReturnPeriods_Box10_not_null | NOT NULL "Box10" |
| VatReturnPeriods_Box11_not_null | NOT NULL "Box11" |
| VatReturnPeriods_Box12_not_null | NOT NULL "Box12" |
| VatReturnPeriods_Box13a_not_null | NOT NULL "Box13a" |
| VatReturnPeriods_Box13b_not_null | NOT NULL "Box13b" |
| VatReturnPeriods_Box1a_not_null | NOT NULL "Box1a" |
| VatReturnPeriods_Box1b_not_null | NOT NULL "Box1b" |
| VatReturnPeriods_Box2_not_null | NOT NULL "Box2" |
| VatReturnPeriods_Box3_not_null | NOT NULL "Box3" |
| VatReturnPeriods_Box4_not_null | NOT NULL "Box4" |
| VatReturnPeriods_Box9b_not_null | NOT NULL "Box9b" |
| VatReturnPeriods_CalculationVersion_not_null | NOT NULL "CalculationVersion" |
| VatReturnPeriods_DueDate_not_null | NOT NULL "DueDate" |
| VatReturnPeriods_Id_not_null | NOT NULL "Id" |
| VatReturnPeriods_PeriodEnd_not_null | NOT NULL "PeriodEnd" |
| VatReturnPeriods_PeriodLabel_not_null | NOT NULL "PeriodLabel" |
| VatReturnPeriods_PeriodStart_not_null | NOT NULL "PeriodStart" |
| VatReturnPeriods_PeriodType_not_null | NOT NULL "PeriodType" |
| VatReturnPeriods_PetroleumExcluded_not_null | NOT NULL "PetroleumExcluded" |
| VatReturnPeriods_SnapshotVersion_not_null | NOT NULL "SnapshotVersion" |
| VatReturnPeriods_Status_not_null | NOT NULL "Status" |
| VatReturnPeriods_TenantId_not_null | NOT NULL "TenantId" |

| Index | Definition |
|---|---|
| IX_VatReturnPeriods_TenantId | CREATE INDEX "IX_VatReturnPeriods_TenantId" ON public."VatReturnPeriods" USING btree ("TenantId") |
| IX_VatReturnPeriods_TenantId_PeriodStart_PeriodEnd | CREATE UNIQUE INDEX "IX_VatReturnPeriods_TenantId_PeriodStart_PeriodEnd" ON public."VatReturnPeriods" USING btree ("TenantId", "PeriodStart", "PeriodEnd") |
| PK_VatReturnPeriods | CREATE UNIQUE INDEX "PK_VatReturnPeriods" ON public."VatReturnPeriods" USING btree ("Id") |

## VendorDiscounts

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| Id | integer | NO | nextval('"VendorDiscounts_Id_seq"'::regclass) | NO |
| TenantId | integer | NO |  | NO |
| SupplierId | integer | NO |  | NO |
| PurchaseId | integer | YES |  | NO |
| Amount | numeric(18,2) | NO |  | NO |
| DiscountDate | timestamp with time zone | NO |  | NO |
| DiscountType | varchar(50) | NO |  | NO |
| Reason | varchar(500) | NO | ''::character varying | NO |
| IsActive | boolean | NO | true | NO |
| CreatedBy | integer | NO |  | NO |
| CreatedAt | timestamp with time zone | NO | (now() AT TIME ZONE 'utc'::text) | NO |
| UpdatedAt | timestamp with time zone | NO | (now() AT TIME ZONE 'utc'::text) | NO |

| Constraint | Definition |
|---|---|
| FK_VendorDiscounts_Purchases_PurchaseId | FOREIGN KEY ("PurchaseId") REFERENCES "Purchases"("Id") ON DELETE SET NULL |
| FK_VendorDiscounts_Suppliers_SupplierId | FOREIGN KEY ("SupplierId") REFERENCES "Suppliers"("Id") ON DELETE RESTRICT |
| FK_VendorDiscounts_Users_CreatedBy | FOREIGN KEY ("CreatedBy") REFERENCES "Users"("Id") ON DELETE CASCADE |
| VendorDiscounts_Amount_not_null | NOT NULL "Amount" |
| VendorDiscounts_CreatedAt_not_null | NOT NULL "CreatedAt" |
| VendorDiscounts_CreatedBy_not_null | NOT NULL "CreatedBy" |
| VendorDiscounts_DiscountDate_not_null | NOT NULL "DiscountDate" |
| VendorDiscounts_DiscountType_not_null | NOT NULL "DiscountType" |
| VendorDiscounts_Id_not_null | NOT NULL "Id" |
| VendorDiscounts_IsActive_not_null | NOT NULL "IsActive" |
| VendorDiscounts_Reason_not_null | NOT NULL "Reason" |
| VendorDiscounts_SupplierId_not_null | NOT NULL "SupplierId" |
| VendorDiscounts_TenantId_not_null | NOT NULL "TenantId" |
| VendorDiscounts_UpdatedAt_not_null | NOT NULL "UpdatedAt" |
| VendorDiscounts_pkey | PRIMARY KEY ("Id") |

| Index | Definition |
|---|---|
| IX_VendorDiscounts_CreatedBy | CREATE INDEX "IX_VendorDiscounts_CreatedBy" ON public."VendorDiscounts" USING btree ("CreatedBy") |
| IX_VendorDiscounts_PurchaseId | CREATE INDEX "IX_VendorDiscounts_PurchaseId" ON public."VendorDiscounts" USING btree ("PurchaseId") |
| IX_VendorDiscounts_SupplierId | CREATE INDEX "IX_VendorDiscounts_SupplierId" ON public."VendorDiscounts" USING btree ("SupplierId") |
| IX_VendorDiscounts_TenantId | CREATE INDEX "IX_VendorDiscounts_TenantId" ON public."VendorDiscounts" USING btree ("TenantId") |
| VendorDiscounts_pkey | CREATE UNIQUE INDEX "VendorDiscounts_pkey" ON public."VendorDiscounts" USING btree ("Id") |

## __EFMigrationsHistory

| Field | PostgreSQL type | Nullable | Default | Identity |
|---|---|---|---|---|
| MigrationId | varchar(150) | NO |  | NO |
| ProductVersion | varchar(32) | NO |  | NO |

| Constraint | Definition |
|---|---|
| PK___EFMigrationsHistory | PRIMARY KEY ("MigrationId") |
| __EFMigrationsHistory_MigrationId_not_null | NOT NULL "MigrationId" |
| __EFMigrationsHistory_ProductVersion_not_null | NOT NULL "ProductVersion" |

| Index | Definition |
|---|---|
| PK___EFMigrationsHistory | CREATE UNIQUE INDEX "PK___EFMigrationsHistory" ON public."__EFMigrationsHistory" USING btree ("MigrationId") |

## Identity sequences

| Name | Type | Start | Minimum | Maximum | Increment | Cycles |
|---|---|---|---|---|---|---|
| Agreements_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| Alerts_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| AuditLogs_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| BackupDeviceSchedules_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| BackupDeviceTokens_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| BackupDevices_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| BackupPairingCodes_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| BackupRuns_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| BranchStaff_Id_seq | bigint | 1 | 1 | 9223372036854775807 | 1 | False |
| Branches_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| CashDrawerMovements_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| CreditNotes_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| CustomerItemPrices_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| CustomerVisits_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| Customers_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| DailyCashCloses_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| DamageCategories_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| DamageInventories_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| DemoRequests_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| ErrorLogs_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| ExpenseCategories_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| Expenses_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| FailedLoginAttempts_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| HeldInvoices_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| InventoryTransactions_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| InvoiceTemplates_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| InvoiceVersions_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| PaymentReceipts_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| Payments_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| PriceChangeLogs_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| ProductCategories_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| Products_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| PurchaseItems_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| PurchaseReturnItems_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| PurchaseReturns_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| Purchases_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| QuotationItems_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| Quotations_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| RecurringExpenses_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| RecurringInvoiceItems_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| RecurringInvoices_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| RouteCustomers_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| RouteExpenses_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| RouteStaff_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| Routes_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| SalaryCertificates_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| SaleItems_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| SaleReturnItems_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| SaleReturns_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| Sales_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| SubscriptionPlans_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| Subscriptions_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| SupplierCategories_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| SupplierLedgerCredits_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| SupplierPayments_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| Suppliers_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| SupportSessions_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| TenantInvites_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| TenantVatBasisHistory_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| Tenants_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| UserSessions_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| Users_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| VatReturnPeriods_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| VendorDiscounts_Id_seq | integer | 1 | 1 | 2147483647 | 1 | False |
| invoice_number_seq | bigint | 2000 | 1 | 9223372036854775807 | 1 | False |

## Triggers

| Table | Trigger | Timing | Event |
|---|---|---|---|
| None | | | |
