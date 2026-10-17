# Live HexaBill database schema — 2026-10-17

Generated from the live Render PostgreSQL database `hexabill` with read-only catalog queries. No DDL or DML was run for this file. Row counts are exact `count(*)` values at the snapshot time and change as users write. The database password and connection string are NOT in this file; they live only in the gitignored `backend/HexaBill.Api/.env`.

Snapshot taken: 2026-10-17 09:45:34 UTC.

## Verified status at snapshot

- Backend `https://hexabill.onrender.com/health/ready`: `Ready`, database `Connected`, schema `Current`, `deployVersion` `84c9e1ff83ef768c9206c891e890b5387c71ba46` (= local `main`).
- Render service `srv-d68jpdvpm1nc7393q4d0` (HexaBill): `autoDeploy` is `no` in the Render service settings. Live deploy `dep-db9iamvavr4c73e6gpvg` for commit `84c9e1f` finished 2026-10-17 07:38:04 UTC. The earlier `86eafed` note in other docs is stale.
- Frontend live bundle `assets/index-C7xkt4XT.js` contains the `(Ref:` toast format and no longer contains the `Something went wrong. Ref:` string.
- Migrations: 55 rows in `__EFMigrationsHistory`; 54 migration files on disk; migration files not yet applied: none.
- History rows with no file in the current tree: `20260215070856_AddBranchIdToExpense`. The file was present in git history (commits `c4fe8f2`, `0bd5828`) and was later removed. The column it added is live: `Expenses.BranchId` (integer). Decision: keep the history row; do not edit applied history.
- Return numbers: `IX_SaleReturns_TenantId_ReturnNo` and `IX_PurchaseReturns_TenantId_ReturnNo` are unique per tenant. The old global `ReturnNo` indexes are gone. Duplicate (TenantId, ReturnNo) pairs: 0 in both tables.
- Products: unique `(TenantId, Sku)` present. Barcode unique per tenant where not null.
- Customers: no unique phone index (phone duplicates are rejected in the API service layer, by design).
- Shape: 67 base tables, 871 columns, 22679 rows in total.
- ErrorLogs: no product or customer insert failures in the last 14 days. Entries are unauthenticated logo fetches (`SECURITY: tenant_id claim missing from token`, tenant 22) and one client-reported barcode auto-fill 500 on 2026-10-13. No ErrorLogs rows after 2026-10-17 07:38 UTC.
- Post-deploy writes: Customer `126` (tenant 22) created 2026-10-17 07:45:57 UTC. No product was created after the deploy.

## Open items (not changed by this snapshot)

1. Live product create after the 07:38 UTC deploy is NOT verified. A live write needs explicit owner approval (a marked test row in tenant 22 or a synthetic tenant, soft-deleted afterwards).
2. Logo image requests reach `/api/storage/tenants/22/logos/...` without a bearer token and are logged as SECURITY errors (about 20 rows, 2026-10-11 to 2026-10-16). Not a DB error; needs an owner decision on how tenant logos are authorised.
3. Barcode auto-fill 500: fixed locally. The method ran a user transaction, which Npgsql EnableRetryOnFailure rejects in production. It now runs inside the execution strategy. Not live until a backend deploy is approved.
4. Sale return 9 (tenant 22) still has no route. The row was not edited.
5. The database password was pasted into chat. Rotation is recommended; it was NOT rotated in this session.
6. Schema drift: `IX_Products_TenantId_Barcode` exists in live and was in no EF migration or model. Fixed locally: the model declares it, and migration `20261017120000_DeclareProductBarcodeUniqueIndex` has an idempotent Up (`CREATE UNIQUE INDEX IF NOT EXISTS`). Applying that migration to live needs approval; it is a no-op there. Also open: the EF model snapshot is SQLite-typed and has drift against the model, so `dotnet ef migrations add` on it generates unrelated drop and add operations. The generated output was discarded. Rebuilding the snapshot is a separate task. Live also has a non-unique `IX_Products_Barcode` that the model does not declare.
7. `Customers.OwnerId` is 0 on 56 live rows. Fixed locally for new rows: the create path now sets it to the tenant id. Backfilling the 56 existing rows is a live UPDATE and needs approval.

## Migration history

| # | MigrationId | EF version |
|---|---|---|
| 1 | 20260214070330_InitialPostgreSQL | 9.0.0 |
| 2 | 20260214173227_AddBranchAndRoute | 9.0.0 |
| 3 | 20260215070856_AddBranchIdToExpense | 9.0.0 |
| 4 | 20260215095609_AddMissingTables | 9.0.0 |
| 5 | 20260215150153_EnterpriseBranchRoutePlan | 9.0.0 |
| 6 | 20260215165632_FixBooleanColumnsType | 9.0.0 |
| 7 | 20260215215659_AddUserSessionVersion | 9.0.0 |
| 8 | 20260217111415_AddHeldInvoiceTable | 9.0.0 |
| 9 | 20260217134457_AddProductsFeatures | 9.0.0 |
| 10 | 20260218024142_AddExpenseRouteId | 9.0.0 |
| 11 | 20260219062317_AddDamageCategoriesAndReturnExtensions | 9.0.0 |
| 12 | 20260219100000_EnsureSettingsValueColumnPascalCase | 9.0.0 |
| 13 | 20260219124000_AddFeaturesJsonToTenants | 9.0.0 |
| 14 | 20260220100000_AddUserPageAccess | 9.0.0 |
| 15 | 20260221100000_FixBranchStaffRouteStaffIdIdentity | 9.0.0 |
| 16 | 20260221120000_AddReturnCategoryAndCondition | 9.0.0 |
| 17 | 20260221120100_AddDamageInventory | 9.0.0 |
| 18 | 20260221120200_AddCreditNotes | 9.0.0 |
| 19 | 20260225120000_AddInvoiceTemplateTenantId | 9.0.0 |
| 20 | 20260225130000_AddExpenseCategoryTenantId | 9.0.0 |
| 21 | 20260305130821_AddSuppliersAndSupplierPayments | 9.0.0 |
| 22 | 20260305131600_AddPurchasePaymentType | 9.0.0 |
| 23 | 20260305162552_AddSupplierAndSupplierPayment | 9.0.0 |
| 24 | 20260307135822_AddVendorDiscountsTable | 10.0.3 |
| 25 | 20260310151454_AddVatReturnEngineFields | 9.0.0 |
| 26 | 20260310165519_AddRoundOffToSalesAndHeldInvoices | 9.0.0 |
| 27 | 20260310170435_AddPaymentReceiptsTable | 9.0.0 |
| 28 | 20260310172228_AddExpenseCategoryVatDefaults | 9.0.0 |
| 29 | 20260315060146_BackfillPurchaseIsTaxClaimable | 9.0.0 |
| 30 | 20260719171633_AddQuotationsAndAgreements | 9.0.0 |
| 31 | 20260719190000_AddQuotationLetterFields | 9.0.0 |
| 32 | 20260728120000_AddSalaryCertificates | 9.0.0 |
| 33 | 20260809180000_AddCustomerLocation | 9.0.0 |
| 34 | 20260810120000_AddCustomerItemPrices | 9.0.0 |
| 35 | 20260810210000_AddCustomerStopLocation | 9.0.0 |
| 36 | 20260920030000_Run1IdentityFields | 9.0.0 |
| 37 | 20260920033000_EnforceTenantSubdomains | 9.0.0 |
| 38 | 20260920050000_SecureOnboardingAndSupport | 9.0.0 |
| 39 | 20260927080000_AddTenantVatCalculationBasis | 9.0.0 |
| 40 | 20260927190000_AddBackupAgentDevices | 9.0.0 |
| 41 | 20261003090000_AddPaymentReceiptSnapshot | 9.0.0 |
| 42 | 20261003110000_AddSaleItemCostBasis | 9.0.0 |
| 43 | 20261003120000_AddPurchaseItemConversionAtPurchase | 9.0.0 |
| 44 | 20261003130000_AddPurchaseItemCostCapturedAt | 9.0.0 |
| 45 | 20261003140000_AddPaymentSettlementAdjustmentFlag | 9.0.0 |
| 46 | 20261003150000_AddDailyCashClose | 9.0.0 |
| 47 | 20261003160000_AddDailyCashCloseBankSnapshot | 9.0.0 |
| 48 | 20261003170000_AddExpensePaidFrom | 9.0.0 |
| 49 | 20261003180000_AddCashDrawerMovement | 9.0.0 |
| 50 | 20261003190000_AddPaymentParentPaymentId | 9.0.0 |
| 51 | 20261010090000_AddVatManagementSnapshot | 9.0.0 |
| 52 | 20261010120000_AddVatCalculationVersioning | 9.0.0 |
| 53 | 20261013090000_PreserveProductConversionPrecision | 9.0.0 |
| 54 | 20261017100000_ScopeSaleReturnNumberToTenant | 9.0.0 |
| 55 | 20261017110000_ScopePurchaseReturnNumberToTenant | 9.0.0 |

## Tenants (ids)

| Id |
|---|
| 3 |
| 6 |
| 8 |
| 20 |
| 21 |
| 22 |
| 23 |

## NOT NULL columns with no database default

Every create path must supply these values. A missing one fails the insert on PostgreSQL. Primary keys are listed for completeness; they are generated by the database.

| Table | Columns |
|---|---|
| Agreements | OwnerId, AgreementNo, AgreementDate, TemplateVersion, Status, CreatedBy, CreatedAt |
| Alerts | OwnerId, Type, Title, Severity, IsRead, IsResolved, CreatedAt |
| AuditLogs | OwnerId, UserId, Action, CreatedAt |
| BackupDeviceSchedules | TenantId, DeviceId, Enabled, Frequency, LocalTime, TimeZoneId, WeeklyDay, IncludeInvoicePdfs, RetentionCount, UpdatedAt |
| BackupDeviceTokens | TenantId, DeviceId, TokenHash, ExpiresAt, CreatedAt |
| BackupDevices | TenantId, CreatedByUserId, DisplayName, CreatedAt |
| BackupPairingCodes | TenantId, CreatedByUserId, CodeHash, ExpiresAt, CreatedAt |
| BackupRuns | TenantId, DeviceId, SlotKey, Status, Verified, MissedCatchUp, StartedAt |
| BranchStaff | BranchId, UserId, AssignedAt |
| Branches | TenantId, Name, CreatedAt |
| CashDrawerMovements | TenantId, OwnerId, MovementDate, Kind, Amount, CreatedByUserId, CreatedAt |
| CreditNotes | TenantId, CustomerId, LinkedReturnId, Amount, Currency, Status, CreatedAt, CreatedBy |
| CustomerItemPrices | TenantId, CustomerId, ProductId, LastUnitPrice, LastSaleDate, UpdatedAt |
| CustomerVisits | RouteId, CustomerId, TenantId, VisitDate |
| Customers | OwnerId, Name, CustomerType, CreatedAt, UpdatedAt |
| DailyCashCloses | TenantId, OwnerId, BusinessDate, Version, Status, OpeningCash, CashReceived, CashPaidOut, ExpectedCash, CountedCash, Variance, CreatedByUserId, CreatedAt, UpdatedAt |
| DamageCategories | TenantId, Name, CreatedAt |
| DamageInventories | TenantId, ProductId, CreatedAt, UpdatedAt |
| DemoRequests | CompanyName, ContactName, WhatsApp, Email, Country, Industry, MonthlySalesRange, StaffCount, Status, CreatedAt |
| ErrorLogs | TraceId, ErrorCode, Message, CreatedAt |
| ExpenseCategories | Name, ColorCode, IsActive, CreatedAt |
| Expenses | OwnerId, CategoryId, Amount, Date, CreatedBy, CreatedAt |
| FailedLoginAttempts | Email, LastAttemptAt, CreatedAt |
| HeldInvoices | TenantId, UserId, Name, InvoiceData, CreatedAt |
| InventoryTransactions | OwnerId, ProductId, ChangeQty, TransactionType, CreatedAt |
| InvoiceTemplates | Name, Version, CreatedBy, CreatedAt, HtmlCode, IsActive |
| InvoiceVersions | OwnerId, SaleId, VersionNumber, CreatedById, CreatedAt, DataJson |
| PaymentIdempotencies | PaymentId, UserId, CreatedAt |
| PaymentReceipts | TenantId, ReceiptNumber, PaymentId, GeneratedAt, GeneratedByUserId |
| Payments | OwnerId, Amount, Mode, Status, PaymentDate, CreatedBy, CreatedAt |
| PriceChangeLogs | OwnerId, ProductId, OldPrice, NewPrice, PriceDifference, ChangedBy, ChangedAt |
| ProductCategories | TenantId, Name, CreatedAt, UpdatedAt |
| Products | OwnerId, Sku, NameEn, UnitType, ConversionToBase, CostPrice, SellPrice, StockQty, ReorderLevel, CreatedAt, UpdatedAt |
| PurchaseItems | PurchaseId, ProductId, UnitType, Qty, UnitCost, LineTotal |
| PurchaseReturnItems | PurchaseReturnId, PurchaseItemId, ProductId, UnitType, Qty, UnitCost, LineTotal |
| PurchaseReturns | OwnerId, PurchaseId, ReturnNo, ReturnDate, Subtotal, VatTotal, GrandTotal, Status, CreatedBy, CreatedAt |
| Purchases | OwnerId, SupplierName, InvoiceNo, PurchaseDate, TotalAmount, CreatedBy, CreatedAt |
| QuotationItems | QuotationId, Description, UnitLabel, Qty, UnitPrice, VatRate, VatAmount, LineTotal, SortOrder |
| Quotations | OwnerId, QuoteNo, QuoteDate, Subtotal, VatTotal, Discount, GrandTotal, Status, CreatedBy, CreatedAt |
| RecurringExpenses | OwnerId, CategoryId, Amount, Frequency, StartDate, IsActive, CreatedBy, CreatedAt, UpdatedAt, CreatedByUserId |
| RecurringInvoiceItems | RecurringInvoiceId, ProductId, Qty, UnitPrice, UnitType |
| RecurringInvoices | TenantId, CustomerId, Frequency, StartDate, NextRunDate, CreatedBy, CreatedAt, UpdatedAt |
| RouteCustomers | RouteId, CustomerId, AssignedAt |
| RouteExpenses | RouteId, TenantId, Category, Amount, ExpenseDate, CreatedBy, CreatedAt |
| RouteStaff | RouteId, UserId, AssignedAt |
| Routes | BranchId, TenantId, Name, CreatedAt |
| SalaryCertificates | OwnerId, CertificateNo, CertificateDate, Status, CreatedBy, CreatedAt |
| SaleItems | SaleId, ProductId, UnitType, Qty, UnitPrice, Discount, VatAmount, LineTotal |
| SaleReturnItems | SaleReturnId, SaleItemId, ProductId, UnitType, Qty, UnitPrice, VatAmount, LineTotal |
| SaleReturns | OwnerId, SaleId, ReturnNo, ReturnDate, Subtotal, VatTotal, Discount, GrandTotal, Status, RestoreStock, IsBadItem, CreatedBy, CreatedAt |
| Sales | OwnerId, InvoiceNo, InvoiceDate, Subtotal, VatTotal, Discount, GrandTotal, TotalAmount, PaymentStatus, CreatedBy, CreatedAt, IsFinalized |
| Settings | Key, OwnerId, CreatedAt, UpdatedAt |
| SubscriptionPlans | Name, MonthlyPrice, YearlyPrice, Currency, MaxUsers, MaxInvoicesPerMonth, MaxCustomers, MaxProducts, MaxStorageMB, HasAdvancedReports, HasApiAccess, HasWhiteLabel, HasPrioritySupport, HasCustomBranding, TrialDays, IsActive, DisplayOrder, CreatedAt |
| Subscriptions | TenantId, PlanId, Status, BillingCycle, StartDate, Amount, Currency, CreatedAt |
| SupplierCategories | Name |
| SupplierLedgerCredits | TenantId, SupplierName, Amount, CreditDate, CreditType, CreatedBy |
| SupplierPayments | Amount, PaymentDate |
| Suppliers | Name, NormalizedName |
| SupportSessions | TenantId, PlatformUserId, Reason, StartedAt, ExpiresAt, ReadOnly |
| TenantInvites | TenantId, UserId, TokenHash, HostSubdomain, CreatedAt, ExpiresAt, CreatedByUserId |
| TenantVatBasisHistory | TenantId, Basis, EffectiveFrom, SetByUserId, CreatedAt |
| Tenants | Name, Subdomain, CreatedAt |
| UserSessions | UserId, TenantId, LoginAt |
| Users | Name, Email, PasswordHash, Role, CreatedAt |
| VatReturnPeriods | TenantId, PeriodType, PeriodLabel, PeriodStart, PeriodEnd, DueDate, Status, Box1a, Box1b, Box2, Box3, Box4, Box9b, Box10, Box11, Box12, Box13a, Box13b, PetroleumExcluded |
| VendorDiscounts | TenantId, SupplierId, Amount, DiscountDate, DiscountType, CreatedBy |
| __EFMigrationsHistory | ProductVersion |

## Table index

| Table | Rows | Primary key | Foreign keys | Unique indexes |
|---|---|---|---|---|
| Agreements | 9 | Id |  | Agreements_pkey, IX_Agreements_TenantId_AgreementNo |
| Alerts | 1216 | Id | ResolvedBy → Users.Id (SET NULL) |  |
| AuditLogs | 1915 | Id | UserId → Users.Id (CASCADE) |  |
| BackupDeviceSchedules | 0 | Id | DeviceId → BackupDevices.Id (CASCADE); TenantId → Tenants.Id (RESTRICT) | IX_BackupDeviceSchedules_DeviceId |
| BackupDeviceTokens | 0 | Id | DeviceId → BackupDevices.Id (CASCADE); TenantId → Tenants.Id (RESTRICT) | IX_BackupDeviceTokens_TokenHash |
| BackupDevices | 0 | Id | CreatedByUserId → Users.Id (RESTRICT); TenantId → Tenants.Id (RESTRICT) |  |
| BackupPairingCodes | 0 | Id | CreatedByUserId → Users.Id (RESTRICT); TenantId → Tenants.Id (RESTRICT) | IX_BackupPairingCodes_CodeHash |
| BackupRuns | 0 | Id | DeviceId → BackupDevices.Id (CASCADE); TenantId → Tenants.Id (RESTRICT) | IX_BackupRuns_DeviceId_SlotKey |
| BranchStaff | 9 | Id | BranchId → Branches.Id (CASCADE); UserId → Users.Id (CASCADE) | IX_BranchStaff_BranchId_UserId |
| Branches | 7 | Id | TenantId → Tenants.Id (CASCADE) | Branches_pkey |
| CashDrawerMovements | 0 | Id |  | CashDrawerMovements_pkey |
| CreditNotes | 1 | Id | CreatedBy → Users.Id (NO ACTION); CustomerId → Customers.Id (CASCADE); LinkedReturnId → SaleReturns.Id (CASCADE); TenantId → Tenants.Id (CASCADE) | CreditNotes_pkey |
| CustomerItemPrices | 862 | Id | CustomerId → Customers.Id (CASCADE); LastSaleId → Sales.Id (SET NULL); ProductId → Products.Id (RESTRICT) | CustomerItemPrices_pkey, IX_CustomerItemPrices_TenantId_CustomerId_ProductId |
| CustomerVisits | 0 | Id | CustomerId → Customers.Id (CASCADE); RouteId → Routes.Id (CASCADE); StaffId → Users.Id (SET NULL); TenantId → Tenants.Id (CASCADE) | CustomerVisits_pkey, IX_CustomerVisits_RouteId_CustomerId_VisitDate |
| Customers | 100 | Id |  |  |
| DailyCashCloses | 1 | Id |  | DailyCashCloses_pkey, IX_DailyCashCloses_TenantId_BusinessDate_BranchId_Version |
| DamageCategories | 15 | Id | TenantId → Tenants.Id (CASCADE) | DamageCategories_pkey |
| DamageInventories | 1 | Id | BranchId → Branches.Id (NO ACTION); ProductId → Products.Id (CASCADE); SourceReturnId → SaleReturns.Id (NO ACTION); TenantId → Tenants.Id (CASCADE) | DamageInventories_pkey |
| DemoRequests | 0 | Id |  |  |
| ErrorLogs | 87 | Id |  |  |
| ExpenseCategories | 85 | Id |  | IX_ExpenseCategories_TenantId_Name |
| Expenses | 75 | Id | BranchId → Branches.Id (NO ACTION); CategoryId → ExpenseCategories.Id (CASCADE); CreatedBy → Users.Id (CASCADE) |  |
| FailedLoginAttempts | 0 | Id |  | FailedLoginAttempts_pkey, IX_FailedLoginAttempts_Email |
| HeldInvoices | 0 | Id | UserId → Users.Id (CASCADE) | HeldInvoices_pkey |
| InventoryTransactions | 7555 | Id | ProductId → Products.Id (CASCADE) |  |
| InvoiceTemplates | 0 | Id | CreatedBy → Users.Id (CASCADE) |  |
| InvoiceVersions | 83 | Id | CreatedById → Users.Id (CASCADE); SaleId → Sales.Id (CASCADE) |  |
| PaymentIdempotencies | 398 | IdempotencyKey | PaymentId → Payments.Id (CASCADE); UserId → Users.Id (CASCADE) | IX_PaymentIdempotencies_IdempotencyKey |
| PaymentReceipts | 5 | Id | GeneratedByUserId → Users.Id (CASCADE); PaymentId → Payments.Id (CASCADE) | IX_PaymentReceipts_TenantId_PaymentId, IX_PaymentReceipts_TenantId_ReceiptNumber |
| Payments | 1011 | Id | CreatedBy → Users.Id (CASCADE); CustomerId → Customers.Id (NO ACTION); SaleId → Sales.Id (NO ACTION) |  |
| PriceChangeLogs | 18 | Id | ChangedBy → Users.Id (CASCADE); ProductId → Products.Id (CASCADE) |  |
| ProductCategories | 5 | Id |  | IX_ProductCategories_TenantId_Name, ProductCategories_pkey |
| Products | 131 | Id | CategoryId → ProductCategories.Id (SET NULL) | IX_Products_TenantId_Barcode, IX_Products_TenantId_Sku |
| PurchaseItems | 331 | Id | ProductId → Products.Id (CASCADE); PurchaseId → Purchases.Id (CASCADE) |  |
| PurchaseReturnItems | 0 | Id | ProductId → Products.Id (CASCADE); PurchaseItemId → PurchaseItems.Id (CASCADE); PurchaseReturnId → PurchaseReturns.Id (CASCADE) |  |
| PurchaseReturns | 0 | Id | CreatedBy → Users.Id (CASCADE); PurchaseId → Purchases.Id (CASCADE) | IX_PurchaseReturns_TenantId_ReturnNo |
| Purchases | 33 | Id | CreatedBy → Users.Id (CASCADE); SupplierId → Suppliers.Id (SET NULL) | IX_Purchases_OwnerId_InvoiceNo |
| QuotationItems | 3 | Id | ProductId → Products.Id (SET NULL); QuotationId → Quotations.Id (CASCADE) | QuotationItems_pkey |
| Quotations | 3 | Id | CustomerId → Customers.Id (SET NULL) | IX_Quotations_TenantId_QuoteNo, Quotations_pkey |
| RecurringExpenses | 0 | Id |  |  |
| RecurringInvoiceItems | 0 | Id | ProductId → Products.Id (CASCADE); RecurringInvoiceId → RecurringInvoices.Id (CASCADE) |  |
| RecurringInvoices | 0 | Id | BranchId → Branches.Id (NO ACTION); CustomerId → Customers.Id (CASCADE); RouteId → Routes.Id (NO ACTION) |  |
| RouteCustomers | 48 | Id | CustomerId → Customers.Id (CASCADE); RouteId → Routes.Id (CASCADE) | IX_RouteCustomers_RouteId_CustomerId, RouteCustomers_pkey |
| RouteExpenses | 0 | Id | CreatedBy → Users.Id (CASCADE); RouteId → Routes.Id (CASCADE); TenantId → Tenants.Id (CASCADE) | RouteExpenses_pkey |
| RouteStaff | 4 | Id | RouteId → Routes.Id (CASCADE); UserId → Users.Id (CASCADE) | IX_RouteStaff_RouteId_UserId, RouteStaff_pkey |
| Routes | 6 | Id | AssignedStaffId → Users.Id (SET NULL); BranchId → Branches.Id (CASCADE); TenantId → Tenants.Id (CASCADE) | Routes_pkey |
| SalaryCertificates | 7 | Id |  | IX_SalaryCertificates_TenantId_CertificateNo, SalaryCertificates_pkey |
| SaleItems | 6680 | Id | ProductId → Products.Id (CASCADE); SaleId → Sales.Id (CASCADE) |  |
| SaleReturnItems | 4 | Id | ProductId → Products.Id (CASCADE); SaleItemId → SaleItems.Id (CASCADE); SaleReturnId → SaleReturns.Id (CASCADE) |  |
| SaleReturns | 4 | Id | CreatedBy → Users.Id (CASCADE); CustomerId → Customers.Id (NO ACTION); SaleId → Sales.Id (CASCADE) | IX_SaleReturns_TenantId_ReturnNo |
| Sales | 1118 | Id | BranchId → Branches.Id (SET NULL); CreatedBy → Users.Id (CASCADE); CustomerId → Customers.Id (NO ACTION); DeletedBy → Users.Id (NO ACTION); LastModifiedBy → Users.Id (NO ACTION); RouteId → Routes.Id (SET NULL) | IX_Sales_ExternalReference, IX_Sales_OwnerId_InvoiceNo |
| Settings | 214 | Key, OwnerId | TenantId → Tenants.Id (NO ACTION) |  |
| SubscriptionPlans | 1 | Id |  |  |
| Subscriptions | 6 | Id | PlanId → SubscriptionPlans.Id (CASCADE); TenantId → Tenants.Id (CASCADE) |  |
| SupplierCategories | 0 | Id |  | IX_SupplierCategories_TenantId_Name, SupplierCategories_pkey |
| SupplierLedgerCredits | 18 | Id |  | SupplierLedgerCredits_pkey |
| SupplierPayments | 27 | Id | PurchaseId → Purchases.Id (SET NULL); SupplierId → Suppliers.Id (RESTRICT) | SupplierPayments_pkey |
| Suppliers | 19 | Id | CategoryId → SupplierCategories.Id (SET NULL) | IX_Suppliers_TenantId_NormalizedName, Suppliers_pkey |
| SupportSessions | 12 | Id | PlatformUserId → Users.Id (RESTRICT); TenantId → Tenants.Id (CASCADE) | SupportSessions_pkey |
| TenantInvites | 3 | Id | TenantId → Tenants.Id (CASCADE); UserId → Users.Id (CASCADE) | IX_TenantInvites_TokenHash, TenantInvites_pkey |
| TenantVatBasisHistory | 0 | Id | SetByUserId → Users.Id (RESTRICT); TenantId → Tenants.Id (RESTRICT) |  |
| Tenants | 7 | Id |  | IX_Tenants_Domain, IX_Tenants_Subdomain |
| UserSessions | 442 | Id | UserId → Users.Id (CASCADE) | UserSessions_pkey |
| Users | 22 | Id | TenantId → Tenants.Id (NO ACTION) | IX_Users_TenantId_Email |
| VatReturnPeriods | 10 | Id |  | IX_VatReturnPeriods_TenantId_PeriodStart_PeriodEnd |
| VendorDiscounts | 13 | Id | CreatedBy → Users.Id (CASCADE); PurchaseId → Purchases.Id (SET NULL); SupplierId → Suppliers.Id (RESTRICT) | VendorDiscounts_pkey |
| __EFMigrationsHistory | 55 | MigrationId |  |  |

## Tables

### Agreements

Rows: 9. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO | nextval('"Agreements_Id_seq"'::regclass) |  | 32 | 0 |
| OwnerId | integer | NO |  |  | 32 | 0 |
| TenantId | integer | YES |  |  | 32 | 0 |
| AgreementNo | character varying | NO |  | 50 |  |  |
| AgreementDate | timestamp with time zone | NO |  |  |  |  |
| SecondPartyName | character varying | YES |  | 200 |  |  |
| SecondPartyLicense | character varying | YES |  | 100 |  |  |
| SecondPartyAddress | character varying | YES |  | 500 |  |  |
| SecondPartyMobile | character varying | YES |  | 50 |  |  |
| TemplateVersion | character varying | NO |  | 20 |  |  |
| Status | character varying | NO |  | 20 |  |  |
| Notes | text | YES |  |  |  |  |
| CreatedBy | integer | NO |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| LastModifiedBy | integer | YES |  |  | 32 | 0 |
| LastModifiedAt | timestamp with time zone | YES |  |  |  |  |
| IsDeleted | boolean | NO | false |  |  |  |
| DeletedBy | integer | YES |  |  | 32 | 0 |
| DeletedAt | timestamp with time zone | YES |  |  |  |  |

Indexes:
- `Agreements_pkey`
- `IX_Agreements_TenantId`
- `IX_Agreements_TenantId_AgreementNo`

### Alerts

Rows: 1216. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| OwnerId | integer | NO |  |  | 32 | 0 |
| TenantId | integer | YES |  |  | 32 | 0 |
| Type | character varying | NO |  | 100 |  |  |
| Title | character varying | NO |  | 200 |  |  |
| Message | character varying | YES |  | 2000 |  |  |
| Severity | character varying | NO |  | 50 |  |  |
| IsRead | boolean | NO |  |  |  |  |
| IsResolved | boolean | NO |  |  |  |  |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| ReadAt | timestamp with time zone | YES |  |  |  |  |
| ResolvedAt | timestamp with time zone | YES |  |  |  |  |
| ResolvedBy | integer | YES |  |  | 32 | 0 |
| Metadata | character varying | YES |  | 500 |  |  |

Foreign keys:
- `ResolvedBy` → `Users.Id` (on delete SET NULL)

Indexes:
- `IX_Alerts_CreatedAt`
- `IX_Alerts_IsRead`
- `IX_Alerts_IsResolved`
- `IX_Alerts_ResolvedBy`
- `IX_Alerts_Type`
- `PK_Alerts`

### AuditLogs

Rows: 1915. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| OwnerId | integer | NO |  |  | 32 | 0 |
| TenantId | integer | YES |  |  | 32 | 0 |
| UserId | integer | NO |  |  | 32 | 0 |
| Action | character varying | NO |  | 200 |  |  |
| EntityType | character varying | YES |  | 100 |  |  |
| EntityId | integer | YES |  |  | 32 | 0 |
| OldValues | text | YES |  |  |  |  |
| NewValues | text | YES |  |  |  |  |
| IpAddress | character varying | YES |  | 45 |  |  |
| Details | text | YES |  |  |  |  |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |

Foreign keys:
- `UserId` → `Users.Id` (on delete CASCADE)

Indexes:
- `IX_AuditLogs_CreatedAt`
- `IX_AuditLogs_EntityType_EntityId`
- `IX_AuditLogs_TenantId`
- `IX_AuditLogs_UserId`
- `PK_AuditLogs`

### BackupDeviceSchedules

Rows: 0. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| DeviceId | integer | NO |  |  | 32 | 0 |
| Enabled | boolean | NO |  |  |  |  |
| Frequency | character varying | NO |  | 16 |  |  |
| LocalTime | character varying | NO |  | 5 |  |  |
| TimeZoneId | character varying | NO |  | 80 |  |  |
| WeeklyDay | integer | NO |  |  | 32 | 0 |
| IncludeInvoicePdfs | boolean | NO |  |  |  |  |
| RetentionCount | integer | NO |  |  | 32 | 0 |
| UpdatedAt | timestamp with time zone | NO |  |  |  |  |

Foreign keys:
- `DeviceId` → `BackupDevices.Id` (on delete CASCADE)
- `TenantId` → `Tenants.Id` (on delete RESTRICT)

Indexes:
- `IX_BackupDeviceSchedules_DeviceId`
- `IX_BackupDeviceSchedules_TenantId`
- `PK_BackupDeviceSchedules`

### BackupDeviceTokens

Rows: 0. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| DeviceId | integer | NO |  |  | 32 | 0 |
| TokenHash | character varying | NO |  | 64 |  |  |
| ExpiresAt | timestamp with time zone | NO |  |  |  |  |
| RevokedAt | timestamp with time zone | YES |  |  |  |  |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |

Foreign keys:
- `DeviceId` → `BackupDevices.Id` (on delete CASCADE)
- `TenantId` → `Tenants.Id` (on delete RESTRICT)

Indexes:
- `IX_BackupDeviceTokens_DeviceId`
- `IX_BackupDeviceTokens_TokenHash`
- `PK_BackupDeviceTokens`

### BackupDevices

Rows: 0. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| CreatedByUserId | integer | NO |  |  | 32 | 0 |
| DisplayName | character varying | NO |  | 80 |  |  |
| FolderLabel | character varying | YES |  | 120 |  |  |
| LastSeenAt | timestamp with time zone | YES |  |  |  |  |
| RevokedAt | timestamp with time zone | YES |  |  |  |  |
| AgentVersion | character varying | YES |  | 40 |  |  |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |

Foreign keys:
- `CreatedByUserId` → `Users.Id` (on delete RESTRICT)
- `TenantId` → `Tenants.Id` (on delete RESTRICT)

Indexes:
- `IX_BackupDevices_CreatedByUserId`
- `IX_BackupDevices_TenantId`
- `PK_BackupDevices`

### BackupPairingCodes

Rows: 0. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| CreatedByUserId | integer | NO |  |  | 32 | 0 |
| CodeHash | character varying | NO |  | 64 |  |  |
| ExpiresAt | timestamp with time zone | NO |  |  |  |  |
| ConsumedAt | timestamp with time zone | YES |  |  |  |  |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |

Foreign keys:
- `CreatedByUserId` → `Users.Id` (on delete RESTRICT)
- `TenantId` → `Tenants.Id` (on delete RESTRICT)

Indexes:
- `IX_BackupPairingCodes_CodeHash`
- `IX_BackupPairingCodes_CreatedByUserId`
- `IX_BackupPairingCodes_TenantId`
- `PK_BackupPairingCodes`

### BackupRuns

Rows: 0. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| DeviceId | integer | NO |  |  | 32 | 0 |
| SlotKey | character varying | NO |  | 16 |  |  |
| Status | character varying | NO |  | 20 |  |  |
| SizeBytes | bigint | YES |  |  | 64 | 0 |
| Sha256 | character varying | YES |  | 64 |  |  |
| Verified | boolean | NO |  |  |  |  |
| MissedCatchUp | boolean | NO |  |  |  |  |
| FailureReason | character varying | YES |  | 200 |  |  |
| FileName | character varying | YES |  | 180 |  |  |
| DownloadName | character varying | YES |  | 180 |  |  |
| StartedAt | timestamp with time zone | NO |  |  |  |  |
| CompletedAt | timestamp with time zone | YES |  |  |  |  |

Foreign keys:
- `DeviceId` → `BackupDevices.Id` (on delete CASCADE)
- `TenantId` → `Tenants.Id` (on delete RESTRICT)

Indexes:
- `IX_BackupRuns_DeviceId_SlotKey`
- `IX_BackupRuns_TenantId`
- `PK_BackupRuns`

### BranchStaff

Rows: 9. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO | nextval('"BranchStaff_Id_seq"'::regclass) |  | 32 | 0 |
| BranchId | integer | NO |  |  | 32 | 0 |
| UserId | integer | NO |  |  | 32 | 0 |
| AssignedAt | timestamp with time zone | NO |  |  |  |  |

Foreign keys:
- `BranchId` → `Branches.Id` (on delete CASCADE)
- `UserId` → `Users.Id` (on delete CASCADE)

Indexes:
- `IX_BranchStaff_BranchId`
- `IX_BranchStaff_BranchId_UserId`
- `IX_BranchStaff_UserId`
- `PK_BranchStaff`

### Branches

Rows: 7. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| Name | character varying | NO |  | 200 |  |  |
| Address | character varying | YES |  | 500 |  |  |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| UpdatedAt | timestamp with time zone | YES |  |  |  |  |
| IsActive | boolean | NO | true |  |  |  |
| Location | character varying | YES |  | 200 |  |  |
| ManagerUserId | integer | YES |  |  | 32 | 0 |
| ManagerId | integer | YES |  |  | 32 | 0 |
| ManagerId1 | integer | YES |  |  | 32 | 0 |

Foreign keys:
- `TenantId` → `Tenants.Id` (on delete CASCADE)

Indexes:
- `Branches_pkey`
- `IX_Branches_TenantId`

### CashDrawerMovements

Rows: 0. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| OwnerId | integer | NO |  |  | 32 | 0 |
| BranchId | integer | YES |  |  | 32 | 0 |
| MovementDate | timestamp with time zone | NO |  |  |  |  |
| Kind | integer | NO |  |  | 32 | 0 |
| Amount | numeric | NO |  |  | 18 | 2 |
| Note | character varying | YES |  | 500 |  |  |
| CreatedByUserId | integer | NO |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |

Indexes:
- `CashDrawerMovements_pkey`
- `IX_CashDrawerMovements_TenantId_MovementDate`

### CreditNotes

Rows: 1. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO | nextval('"CreditNotes_Id_seq"'::regclass) |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| CustomerId | integer | NO |  |  | 32 | 0 |
| LinkedReturnId | integer | NO |  |  | 32 | 0 |
| Amount | numeric | NO |  |  | 18 | 2 |
| Currency | character varying | NO |  | 10 |  |  |
| Status | character varying | NO |  | 20 |  |  |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| CreatedBy | integer | NO |  |  | 32 | 0 |
| AppliedAmount | numeric | NO | 0 |  | 18 | 2 |

Foreign keys:
- `CreatedBy` → `Users.Id` (on delete NO ACTION)
- `CustomerId` → `Customers.Id` (on delete CASCADE)
- `LinkedReturnId` → `SaleReturns.Id` (on delete CASCADE)
- `TenantId` → `Tenants.Id` (on delete CASCADE)

Indexes:
- `CreditNotes_pkey`
- `IX_CreditNotes_CustomerId`
- `IX_CreditNotes_LinkedReturnId`
- `IX_CreditNotes_TenantId`

### CustomerItemPrices

Rows: 862. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| CustomerId | integer | NO |  |  | 32 | 0 |
| ProductId | integer | NO |  |  | 32 | 0 |
| LastUnitPrice | numeric | NO |  |  | 18 | 2 |
| LastSaleId | integer | YES |  |  | 32 | 0 |
| LastSaleDate | timestamp with time zone | NO |  |  |  |  |
| UpdatedAt | timestamp with time zone | NO |  |  |  |  |

Foreign keys:
- `CustomerId` → `Customers.Id` (on delete CASCADE)
- `LastSaleId` → `Sales.Id` (on delete SET NULL)
- `ProductId` → `Products.Id` (on delete RESTRICT)

Indexes:
- `CustomerItemPrices_pkey`
- `IX_CustomerItemPrices_CustomerId`
- `IX_CustomerItemPrices_LastSaleId`
- `IX_CustomerItemPrices_ProductId`
- `IX_CustomerItemPrices_TenantId_CustomerId_ProductId`

### CustomerVisits

Rows: 0. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO | nextval('"CustomerVisits_Id_seq"'::regclass) |  | 32 | 0 |
| RouteId | integer | NO |  |  | 32 | 0 |
| CustomerId | integer | NO |  |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| StaffId | integer | YES |  |  | 32 | 0 |
| VisitDate | timestamp with time zone | NO |  |  |  |  |
| Status | character varying | NO | 'NotVisited'::character varying | 50 |  |  |
| Notes | character varying | YES |  | 500 |  |  |
| PaymentCollected | numeric | YES |  |  | 18 | 2 |
| CreatedAt | timestamp with time zone | NO | (now() AT TIME ZONE 'utc'::text) |  |  |  |
| UpdatedAt | timestamp with time zone | YES |  |  |  |  |
| Latitude | numeric | YES |  |  | 9 | 6 |
| Longitude | numeric | YES |  |  | 9 | 6 |
| ReachedAt | timestamp with time zone | YES |  |  |  |  |

Foreign keys:
- `CustomerId` → `Customers.Id` (on delete CASCADE)
- `RouteId` → `Routes.Id` (on delete CASCADE)
- `StaffId` → `Users.Id` (on delete SET NULL)
- `TenantId` → `Tenants.Id` (on delete CASCADE)

Indexes:
- `CustomerVisits_pkey`
- `IX_CustomerVisits_RouteId_CustomerId_VisitDate`
- `IX_CustomerVisits_TenantId`
- `IX_CustomerVisits_TenantId_CustomerId_VisitDate`
- `IX_CustomerVisits_VisitDate`

### Customers

Rows: 100. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| OwnerId | integer | NO |  |  | 32 | 0 |
| TenantId | integer | YES |  |  | 32 | 0 |
| Name | character varying | NO |  | 200 |  |  |
| CustomerType | integer | NO |  |  | 32 | 0 |
| Phone | character varying | YES |  | 20 |  |  |
| Email | character varying | YES |  | 100 |  |  |
| Trn | character varying | YES |  | 50 |  |  |
| Address | character varying | YES |  | 500 |  |  |
| CreditLimit | numeric | NO | 0.0 |  | 18 | 2 |
| TotalSales | numeric | NO | 0.0 |  | 18 | 2 |
| TotalPayments | numeric | NO | 0.0 |  | 18 | 2 |
| PendingBalance | numeric | NO | 0.0 |  | 18 | 2 |
| Balance | numeric | NO | 0.0 |  | 18 | 2 |
| LastActivity | timestamp with time zone | YES |  |  |  |  |
| LastPaymentDate | timestamp with time zone | YES |  |  |  |  |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| UpdatedAt | timestamp with time zone | NO |  |  |  |  |
| RowVersion | bytea | YES | '\x00'::bytea |  |  |  |
| PaymentTerms | character varying | YES |  | 100 |  |  |
| BranchId | integer | YES |  |  | 32 | 0 |
| RouteId | integer | YES |  |  | 32 | 0 |
| Location | character varying | YES |  | 200 |  |  |
| MainLatitude | numeric | YES |  |  | 9 | 6 |
| MainLongitude | numeric | YES |  |  | 9 | 6 |
| LocationUpdatedAt | timestamp with time zone | YES |  |  |  |  |
| LocationUpdatedBy | integer | YES |  |  | 32 | 0 |

Indexes:
- `IX_Customers_TenantId_HasMainPin`
- `IX_Customers_TenantId_RouteId`
- `PK_Customers`
- `idx_customers_tenant_name`
- `idx_customers_tenantid`

### DailyCashCloses

Rows: 1. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| OwnerId | integer | NO |  |  | 32 | 0 |
| BranchId | integer | YES |  |  | 32 | 0 |
| BusinessDate | timestamp with time zone | NO |  |  |  |  |
| Version | integer | NO |  |  | 32 | 0 |
| Status | text | NO |  |  |  |  |
| OpeningCash | numeric | NO |  |  | 18 | 2 |
| CashReceived | numeric | NO |  |  | 18 | 2 |
| CashPaidOut | numeric | NO |  |  | 18 | 2 |
| ExpectedCash | numeric | NO |  |  | 18 | 2 |
| CountedCash | numeric | NO |  |  | 18 | 2 |
| Variance | numeric | NO |  |  | 18 | 2 |
| VarianceReason | character varying | YES |  | 500 |  |  |
| Comment | character varying | YES |  | 1000 |  |  |
| ClosedAt | timestamp with time zone | YES |  |  |  |  |
| ClosedByUserId | integer | YES |  |  | 32 | 0 |
| ReopenedAt | timestamp with time zone | YES |  |  |  |  |
| ReopenReason | character varying | YES |  | 500 |  |  |
| CreatedByUserId | integer | NO |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| UpdatedAt | timestamp with time zone | NO |  |  |  |  |
| BankPaidOut | numeric | NO | 0 |  | 18 | 2 |
| BankReceived | numeric | NO | 0 |  | 18 | 2 |

Indexes:
- `DailyCashCloses_pkey`
- `IX_DailyCashCloses_TenantId_BusinessDate_BranchId_Version`

### DamageCategories

Rows: 15. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO | nextval('"DamageCategories_Id_seq"'::regclass) |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| Name | character varying | NO |  | 100 |  |  |
| AffectsStock | boolean | NO | true |  |  |  |
| AffectsLedger | boolean | NO | true |  |  |  |
| IsResaleable | boolean | NO | true |  |  |  |
| SortOrder | integer | NO | 0 |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |

Foreign keys:
- `TenantId` → `Tenants.Id` (on delete CASCADE)

Indexes:
- `DamageCategories_pkey`
- `IX_DamageCategories_TenantId`

### DamageInventories

Rows: 1. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO | nextval('"DamageInventories_Id_seq"'::regclass) |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| ProductId | integer | NO |  |  | 32 | 0 |
| BranchId | integer | YES |  |  | 32 | 0 |
| Quantity | numeric | NO | 0 |  | 18 | 2 |
| SourceReturnId | integer | YES |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| UpdatedAt | timestamp with time zone | NO |  |  |  |  |

Foreign keys:
- `BranchId` → `Branches.Id` (on delete NO ACTION)
- `ProductId` → `Products.Id` (on delete CASCADE)
- `SourceReturnId` → `SaleReturns.Id` (on delete NO ACTION)
- `TenantId` → `Tenants.Id` (on delete CASCADE)

Indexes:
- `DamageInventories_pkey`
- `IX_DamageInventories_TenantId_ProductId_BranchId`

### DemoRequests

Rows: 0. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| CompanyName | character varying | NO |  | 200 |  |  |
| ContactName | character varying | NO |  | 100 |  |  |
| WhatsApp | character varying | NO |  | 20 |  |  |
| Email | character varying | NO |  | 100 |  |  |
| Country | character varying | NO |  | 10 |  |  |
| Industry | character varying | NO |  | 100 |  |  |
| MonthlySalesRange | character varying | NO |  | 50 |  |  |
| StaffCount | integer | NO |  |  | 32 | 0 |
| Status | text | NO |  |  |  |  |
| RejectionReason | character varying | YES |  | 500 |  |  |
| AssignedPlanId | integer | YES |  |  | 32 | 0 |
| CreatedTenantId | integer | YES |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| ProcessedAt | timestamp with time zone | YES |  |  |  |  |
| ProcessedByUserId | integer | YES |  |  | 32 | 0 |

Indexes:
- `IX_DemoRequests_CreatedAt`
- `IX_DemoRequests_Email`
- `IX_DemoRequests_Status`
- `PK_DemoRequests`

### ErrorLogs

Rows: 87. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| TraceId | character varying | NO |  | 64 |  |  |
| ErrorCode | character varying | NO |  | 64 |  |  |
| Message | character varying | NO |  | 2000 |  |  |
| StackTrace | text | YES |  |  |  |  |
| Path | character varying | YES |  | 500 |  |  |
| Method | character varying | YES |  | 16 |  |  |
| TenantId | integer | YES |  |  | 32 | 0 |
| UserId | integer | YES |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| ResolvedAt | timestamp with time zone | YES |  |  |  |  |

Indexes:
- `IX_ErrorLogs_CreatedAt`
- `IX_ErrorLogs_ErrorCode`
- `IX_ErrorLogs_ResolvedAt`
- `IX_ErrorLogs_TenantId`
- `PK_ErrorLogs`

### ExpenseCategories

Rows: 85. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| Name | character varying | NO |  | 100 |  |  |
| ColorCode | character varying | NO |  | 7 |  |  |
| IsActive | boolean | NO |  |  |  |  |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| TenantId | integer | YES |  |  | 32 | 0 |
| DefaultVatRate | numeric | NO | 0.0 |  | 5 | 4 |
| DefaultTaxType | character varying | NO | 'Standard'::character varying | 20 |  |  |
| DefaultIsTaxClaimable | boolean | NO | false |  |  |  |
| DefaultIsEntertainment | boolean | NO | false |  |  |  |
| VatDefaultLocked | boolean | NO | false |  |  |  |

Indexes:
- `IX_ExpenseCategories_TenantId_Name`
- `PK_ExpenseCategories`

### Expenses

Rows: 75. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| OwnerId | integer | NO |  |  | 32 | 0 |
| TenantId | integer | YES |  |  | 32 | 0 |
| CategoryId | integer | NO |  |  | 32 | 0 |
| Amount | numeric | NO |  |  | 18 | 2 |
| Date | timestamp with time zone | NO |  |  |  |  |
| Note | character varying | YES |  | 500 |  |  |
| CreatedBy | integer | NO |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| BranchId | integer | YES |  |  | 32 | 0 |
| AttachmentUrl | character varying | YES |  | 500 |  |  |
| Status | integer | NO | 1 |  | 32 | 0 |
| RecurringExpenseId | integer | YES |  |  | 32 | 0 |
| ApprovedBy | integer | YES |  |  | 32 | 0 |
| ApprovedAt | timestamp with time zone | YES |  |  |  |  |
| RejectionReason | text | YES |  |  |  |  |
| RouteId | integer | YES |  |  | 32 | 0 |
| ClaimableVat | numeric | YES |  |  | 18 | 4 |
| IsEntertainment | integer | NO | 0 |  | 32 | 0 |
| IsTaxClaimable | integer | NO | 0 |  | 32 | 0 |
| PartialCreditPct | numeric | NO | 0.0 |  | 18 | 4 |
| TaxType | text | YES |  |  |  |  |
| TotalAmount | numeric | YES |  |  | 18 | 4 |
| VatAmount | numeric | YES |  |  | 18 | 4 |
| VatRate | numeric | YES |  |  | 18 | 4 |
| VatInclusive | boolean | YES |  |  |  |  |
| PaidFrom | integer | NO | 0 |  | 32 | 0 |

Foreign keys:
- `BranchId` → `Branches.Id` (on delete NO ACTION)
- `CategoryId` → `ExpenseCategories.Id` (on delete CASCADE)
- `CreatedBy` → `Users.Id` (on delete CASCADE)

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

### FailedLoginAttempts

Rows: 0. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO | nextval('"FailedLoginAttempts_Id_seq"'::regclass) |  | 32 | 0 |
| Email | character varying | NO |  | 100 |  |  |
| FailedCount | integer | NO | 1 |  | 32 | 0 |
| LockoutUntil | timestamp with time zone | YES |  |  |  |  |
| LastAttemptAt | timestamp with time zone | NO |  |  |  |  |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| UpdatedAt | timestamp with time zone | YES |  |  |  |  |

Indexes:
- `FailedLoginAttempts_pkey`
- `IX_FailedLoginAttempts_Email`
- `IX_FailedLoginAttempts_LastAttemptAt`
- `IX_FailedLoginAttempts_LockoutUntil`

### HeldInvoices

Rows: 0. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO | nextval('"HeldInvoices_Id_seq"'::regclass) |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| UserId | integer | NO |  |  | 32 | 0 |
| Name | character varying | NO |  | 200 |  |  |
| InvoiceData | text | NO |  |  |  |  |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| RoundOff | numeric | NO | 0 |  |  |  |

Foreign keys:
- `UserId` → `Users.Id` (on delete CASCADE)

Indexes:
- `HeldInvoices_pkey`
- `IX_HeldInvoices_UserId`

### InventoryTransactions

Rows: 7555. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| OwnerId | integer | NO |  |  | 32 | 0 |
| TenantId | integer | YES |  |  | 32 | 0 |
| ProductId | integer | NO |  |  | 32 | 0 |
| ChangeQty | numeric | NO |  |  | 18 | 2 |
| TransactionType | text | NO |  |  |  |  |
| RefId | integer | YES |  |  | 32 | 0 |
| Reason | text | YES |  |  |  |  |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |

Foreign keys:
- `ProductId` → `Products.Id` (on delete CASCADE)

Indexes:
- `IX_InventoryTransactions_ProductId`
- `IX_InventoryTransactions_TenantId_TransactionType_CreatedAt`
- `PK_InventoryTransactions`

### InvoiceTemplates

Rows: 0. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| Name | character varying | NO |  | 200 |  |  |
| Version | character varying | NO |  | 50 |  |  |
| CreatedBy | integer | NO |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| UpdatedAt | timestamp with time zone | YES |  |  |  |  |
| HtmlCode | text | NO |  |  |  |  |
| CssCode | text | YES |  |  |  |  |
| IsActive | boolean | NO |  |  |  |  |
| Description | character varying | YES |  | 1000 |  |  |
| TenantId | integer | YES |  |  | 32 | 0 |

Foreign keys:
- `CreatedBy` → `Users.Id` (on delete CASCADE)

Indexes:
- `IX_InvoiceTemplates_CreatedBy`
- `IX_InvoiceTemplates_IsActive`
- `IX_InvoiceTemplates_TenantId`
- `PK_InvoiceTemplates`

### InvoiceVersions

Rows: 83. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| OwnerId | integer | NO |  |  | 32 | 0 |
| TenantId | integer | YES |  |  | 32 | 0 |
| SaleId | integer | NO |  |  | 32 | 0 |
| VersionNumber | integer | NO |  |  | 32 | 0 |
| CreatedById | integer | NO |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| DataJson | jsonb | NO |  |  |  |  |
| EditReason | character varying | YES |  | 500 |  |  |
| DiffSummary | character varying | YES |  | 1000 |  |  |

Foreign keys:
- `CreatedById` → `Users.Id` (on delete CASCADE)
- `SaleId` → `Sales.Id` (on delete CASCADE)

Indexes:
- `IX_InvoiceVersions_CreatedById`
- `IX_InvoiceVersions_SaleId`
- `IX_InvoiceVersions_SaleId_VersionNumber`
- `PK_InvoiceVersions`

### PaymentIdempotencies

Rows: 398. Primary key: IdempotencyKey.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| IdempotencyKey | character varying | NO |  | 100 |  |  |
| PaymentId | integer | NO |  |  | 32 | 0 |
| UserId | integer | NO |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| ResponseSnapshot | jsonb | YES |  |  |  |  |

Foreign keys:
- `PaymentId` → `Payments.Id` (on delete CASCADE)
- `UserId` → `Users.Id` (on delete CASCADE)

Indexes:
- `IX_PaymentIdempotencies_IdempotencyKey`
- `IX_PaymentIdempotencies_PaymentId`
- `IX_PaymentIdempotencies_UserId`
- `PK_PaymentIdempotencies`

### PaymentReceipts

Rows: 5. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| ReceiptNumber | text | NO |  |  |  |  |
| PaymentId | integer | NO |  |  | 32 | 0 |
| GeneratedAt | timestamp with time zone | NO |  |  |  |  |
| GeneratedByUserId | integer | NO |  |  | 32 | 0 |
| PdfStoragePath | text | YES |  |  |  |  |
| SnapshotJson | text | YES |  |  |  |  |

Foreign keys:
- `GeneratedByUserId` → `Users.Id` (on delete CASCADE)
- `PaymentId` → `Payments.Id` (on delete CASCADE)

Indexes:
- `IX_PaymentReceipts_GeneratedByUserId`
- `IX_PaymentReceipts_PaymentId`
- `IX_PaymentReceipts_TenantId_PaymentId`
- `IX_PaymentReceipts_TenantId_ReceiptNumber`
- `PK_PaymentReceipts`

### Payments

Rows: 1011. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| OwnerId | integer | NO |  |  | 32 | 0 |
| TenantId | integer | YES |  |  | 32 | 0 |
| SaleId | integer | YES |  |  | 32 | 0 |
| CustomerId | integer | YES |  |  | 32 | 0 |
| Amount | numeric | NO |  |  | 18 | 2 |
| Mode | text | NO |  |  |  |  |
| Reference | character varying | YES |  | 200 |  |  |
| Status | text | NO |  |  |  |  |
| PaymentDate | timestamp with time zone | NO |  |  |  |  |
| CreatedBy | integer | NO |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| UpdatedAt | timestamp with time zone | YES |  |  |  |  |
| RowVersion | bytea | YES |  |  |  |  |
| SaleReturnId | integer | YES |  |  | 32 | 0 |
| IsSettlementAdjustment | boolean | NO | false |  |  |  |
| ParentPaymentId | integer | YES |  |  | 32 | 0 |

Foreign keys:
- `CreatedBy` → `Users.Id` (on delete CASCADE)
- `CustomerId` → `Customers.Id` (on delete NO ACTION)
- `SaleId` → `Sales.Id` (on delete NO ACTION)

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

### PriceChangeLogs

Rows: 18. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| OwnerId | integer | NO |  |  | 32 | 0 |
| TenantId | integer | YES |  |  | 32 | 0 |
| ProductId | integer | NO |  |  | 32 | 0 |
| OldPrice | numeric | NO |  |  | 18 | 2 |
| NewPrice | numeric | NO |  |  | 18 | 2 |
| PriceDifference | numeric | NO |  |  | 18 | 2 |
| ChangedBy | integer | NO |  |  | 32 | 0 |
| Reason | character varying | YES |  | 500 |  |  |
| ChangedAt | timestamp with time zone | NO |  |  |  |  |

Foreign keys:
- `ChangedBy` → `Users.Id` (on delete CASCADE)
- `ProductId` → `Products.Id` (on delete CASCADE)

Indexes:
- `IX_PriceChangeLogs_ChangedBy`
- `IX_PriceChangeLogs_ProductId`
- `PK_PriceChangeLogs`

### ProductCategories

Rows: 5. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO | nextval('"ProductCategories_Id_seq"'::regclass) |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| Name | character varying | NO |  | 100 |  |  |
| Description | character varying | YES |  | 500 |  |  |
| ColorCode | character varying | YES |  | 20 |  |  |
| IsActive | boolean | NO | true |  |  |  |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| UpdatedAt | timestamp with time zone | NO |  |  |  |  |

Indexes:
- `IX_ProductCategories_TenantId_Name`
- `ProductCategories_pkey`

### Products

Rows: 131. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| OwnerId | integer | NO |  |  | 32 | 0 |
| TenantId | integer | YES |  |  | 32 | 0 |
| Sku | character varying | NO |  | 50 |  |  |
| NameEn | character varying | NO |  | 200 |  |  |
| NameAr | character varying | YES |  | 200 |  |  |
| UnitType | character varying | NO |  | 20 |  |  |
| ConversionToBase | numeric | NO |  |  | 18 | 4 |
| CostPrice | numeric | NO |  |  | 18 | 2 |
| SellPrice | numeric | NO |  |  | 18 | 2 |
| StockQty | numeric | NO |  |  | 18 | 2 |
| ReorderLevel | integer | NO |  |  | 32 | 0 |
| ExpiryDate | timestamp with time zone | YES |  |  |  |  |
| DescriptionEn | text | YES |  |  |  |  |
| DescriptionAr | text | YES |  |  |  |  |
| RowVersion | bytea | NO | '\x00'::bytea |  |  |  |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| UpdatedAt | timestamp with time zone | NO |  |  |  |  |
| Barcode | character varying | YES |  | 100 |  |  |
| ImageUrl | character varying | YES |  | 500 |  |  |
| CategoryId | integer | YES |  |  | 32 | 0 |
| IsActive | boolean | NO | true |  |  |  |

Foreign keys:
- `CategoryId` → `ProductCategories.Id` (on delete SET NULL)

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

### PurchaseItems

Rows: 331. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| PurchaseId | integer | NO |  |  | 32 | 0 |
| ProductId | integer | NO |  |  | 32 | 0 |
| UnitType | character varying | NO |  | 20 |  |  |
| Qty | numeric | NO |  |  | 18 | 2 |
| UnitCost | numeric | NO |  |  | 18 | 2 |
| UnitCostExclVat | numeric | YES |  |  | 18 | 2 |
| VatAmount | numeric | YES |  |  | 18 | 2 |
| LineTotal | numeric | NO |  |  | 18 | 2 |
| ConversionAtPurchase | numeric | YES |  |  | 18 | 6 |
| CostCapturedAt | timestamp with time zone | YES |  |  |  |  |

Foreign keys:
- `ProductId` → `Products.Id` (on delete CASCADE)
- `PurchaseId` → `Purchases.Id` (on delete CASCADE)

Indexes:
- `IX_PurchaseItems_ProductId`
- `IX_PurchaseItems_PurchaseId`
- `PK_PurchaseItems`

### PurchaseReturnItems

Rows: 0. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| PurchaseReturnId | integer | NO |  |  | 32 | 0 |
| PurchaseItemId | integer | NO |  |  | 32 | 0 |
| ProductId | integer | NO |  |  | 32 | 0 |
| UnitType | character varying | NO |  | 20 |  |  |
| Qty | numeric | NO |  |  | 18 | 2 |
| UnitCost | numeric | NO |  |  | 18 | 2 |
| LineTotal | numeric | NO |  |  | 18 | 2 |
| Reason | character varying | YES |  | 200 |  |  |

Foreign keys:
- `ProductId` → `Products.Id` (on delete CASCADE)
- `PurchaseItemId` → `PurchaseItems.Id` (on delete CASCADE)
- `PurchaseReturnId` → `PurchaseReturns.Id` (on delete CASCADE)

Indexes:
- `IX_PurchaseReturnItems_ProductId`
- `IX_PurchaseReturnItems_PurchaseItemId`
- `IX_PurchaseReturnItems_PurchaseReturnId`
- `PK_PurchaseReturnItems`

### PurchaseReturns

Rows: 0. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| OwnerId | integer | NO |  |  | 32 | 0 |
| TenantId | integer | YES |  |  | 32 | 0 |
| PurchaseId | integer | NO |  |  | 32 | 0 |
| SupplierId | integer | YES |  |  | 32 | 0 |
| ReturnNo | character varying | NO |  | 100 |  |  |
| ReturnDate | timestamp with time zone | NO |  |  |  |  |
| Subtotal | numeric | NO |  |  | 18 | 2 |
| VatTotal | numeric | NO |  |  | 18 | 2 |
| GrandTotal | numeric | NO |  |  | 18 | 2 |
| Reason | character varying | YES |  | 500 |  |  |
| Status | text | NO |  |  |  |  |
| CreatedBy | integer | NO |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |

Foreign keys:
- `CreatedBy` → `Users.Id` (on delete CASCADE)
- `PurchaseId` → `Purchases.Id` (on delete CASCADE)

Indexes:
- `IX_PurchaseReturns_CreatedBy`
- `IX_PurchaseReturns_PurchaseId`
- `IX_PurchaseReturns_TenantId_ReturnNo`
- `PK_PurchaseReturns`

### Purchases

Rows: 33. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| OwnerId | integer | NO |  |  | 32 | 0 |
| TenantId | integer | YES |  |  | 32 | 0 |
| SupplierName | character varying | NO |  | 200 |  |  |
| InvoiceNo | character varying | NO |  | 100 |  |  |
| ExternalReference | character varying | YES |  | 200 |  |  |
| ExpenseCategory | character varying | YES |  | 100 |  |  |
| PurchaseDate | timestamp with time zone | NO |  |  |  |  |
| Subtotal | numeric | YES |  |  | 18 | 2 |
| VatTotal | numeric | YES |  |  | 18 | 2 |
| TotalAmount | numeric | NO |  |  | 18 | 2 |
| InvoiceFilePath | character varying | YES |  | 500 |  |  |
| InvoiceFileName | character varying | YES |  | 255 |  |  |
| CreatedBy | integer | NO |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| AmountPaid | numeric | YES |  |  | 18 | 2 |
| PaymentType | character varying | YES |  | 20 |  |  |
| SupplierId | integer | YES |  |  | 32 | 0 |
| DueDate | timestamp with time zone | YES |  |  |  |  |
| IsReverseCharge | integer | NO | 0 |  | 32 | 0 |
| IsTaxClaimable | integer | NO | 0 |  | 32 | 0 |
| ReverseChargeVat | numeric | YES |  |  | 18 | 4 |

Foreign keys:
- `CreatedBy` → `Users.Id` (on delete CASCADE)
- `SupplierId` → `Suppliers.Id` (on delete SET NULL)

Indexes:
- `IX_Purchases_CreatedBy`
- `IX_Purchases_OwnerId_InvoiceNo`
- `IX_Purchases_SupplierId`
- `IX_Purchases_TenantId_SupplierName`
- `PK_Purchases`
- `idx_purchases_createdat`
- `idx_purchases_tenantid`

### QuotationItems

Rows: 3. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO | nextval('"QuotationItems_Id_seq"'::regclass) |  | 32 | 0 |
| QuotationId | integer | NO |  |  | 32 | 0 |
| ProductId | integer | YES |  |  | 32 | 0 |
| Description | character varying | NO |  | 500 |  |  |
| DescriptionSubtitle | character varying | YES |  | 500 |  |  |
| UnitLabel | character varying | NO |  | 50 |  |  |
| Qty | numeric | NO |  |  | 18 | 4 |
| UnitPrice | numeric | NO |  |  | 18 | 4 |
| VatRate | numeric | NO |  |  | 18 | 4 |
| VatAmount | numeric | NO |  |  | 18 | 2 |
| LineTotal | numeric | NO |  |  | 18 | 2 |
| SortOrder | integer | NO |  |  | 32 | 0 |

Foreign keys:
- `ProductId` → `Products.Id` (on delete SET NULL)
- `QuotationId` → `Quotations.Id` (on delete CASCADE)

Indexes:
- `IX_QuotationItems_ProductId`
- `IX_QuotationItems_QuotationId`
- `QuotationItems_pkey`

### Quotations

Rows: 3. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO | nextval('"Quotations_Id_seq"'::regclass) |  | 32 | 0 |
| OwnerId | integer | NO |  |  | 32 | 0 |
| TenantId | integer | YES |  |  | 32 | 0 |
| QuoteNo | character varying | NO |  | 50 |  |  |
| QuoteDate | timestamp with time zone | NO |  |  |  |  |
| CustomerName | character varying | YES |  | 200 |  |  |
| CustomerAddress | character varying | YES |  | 500 |  |  |
| CustomerPhone | character varying | YES |  | 50 |  |  |
| CustomerEmail | character varying | YES |  | 100 |  |  |
| CustomerId | integer | YES |  |  | 32 | 0 |
| Subtotal | numeric | NO |  |  | 18 | 2 |
| VatTotal | numeric | NO |  |  | 18 | 2 |
| Discount | numeric | NO |  |  | 18 | 2 |
| GrandTotal | numeric | NO |  |  | 18 | 2 |
| Status | character varying | NO |  | 20 |  |  |
| Notes | text | YES |  |  |  |  |
| Salutation | character varying | YES |  | 200 |  |  |
| IntroLine | character varying | YES |  | 500 |  |  |
| ClosingLine | character varying | YES |  | 500 |  |  |
| CreatedBy | integer | NO |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| LastModifiedBy | integer | YES |  |  | 32 | 0 |
| LastModifiedAt | timestamp with time zone | YES |  |  |  |  |
| IsDeleted | boolean | NO | false |  |  |  |
| DeletedBy | integer | YES |  |  | 32 | 0 |
| DeletedAt | timestamp with time zone | YES |  |  |  |  |

Foreign keys:
- `CustomerId` → `Customers.Id` (on delete SET NULL)

Indexes:
- `IX_Quotations_CustomerId`
- `IX_Quotations_TenantId`
- `IX_Quotations_TenantId_QuoteNo`
- `Quotations_pkey`

### RecurringExpenses

Rows: 0. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| OwnerId | integer | NO |  |  | 32 | 0 |
| TenantId | integer | YES |  |  | 32 | 0 |
| BranchId | integer | YES |  |  | 32 | 0 |
| CategoryId | integer | NO |  |  | 32 | 0 |
| Amount | numeric | NO |  |  |  |  |
| Note | character varying | YES |  | 500 |  |  |
| Frequency | integer | NO |  |  | 32 | 0 |
| DayOfRecurrence | integer | YES |  |  | 32 | 0 |
| StartDate | timestamp with time zone | NO |  |  |  |  |
| EndDate | timestamp with time zone | YES |  |  |  |  |
| IsActive | boolean | NO |  |  |  |  |
| CreatedBy | integer | NO |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| UpdatedAt | timestamp with time zone | NO |  |  |  |  |
| CreatedByUserId | integer | NO |  |  | 32 | 0 |

Indexes:
- `IX_RecurringExpenses_BranchId`
- `IX_RecurringExpenses_CategoryId`
- `IX_RecurringExpenses_CreatedByUserId`
- `PK_RecurringExpenses`

### RecurringInvoiceItems

Rows: 0. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| RecurringInvoiceId | integer | NO |  |  | 32 | 0 |
| ProductId | integer | NO |  |  | 32 | 0 |
| Qty | numeric | NO |  |  |  |  |
| UnitPrice | numeric | NO |  |  |  |  |
| UnitType | text | NO |  |  |  |  |

Foreign keys:
- `ProductId` → `Products.Id` (on delete CASCADE)
- `RecurringInvoiceId` → `RecurringInvoices.Id` (on delete CASCADE)

Indexes:
- `IX_RecurringInvoiceItems_ProductId`
- `IX_RecurringInvoiceItems_RecurringInvoiceId`
- `PK_RecurringInvoiceItems`

### RecurringInvoices

Rows: 0. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| CustomerId | integer | NO |  |  | 32 | 0 |
| BranchId | integer | YES |  |  | 32 | 0 |
| RouteId | integer | YES |  |  | 32 | 0 |
| Frequency | integer | NO |  |  | 32 | 0 |
| DayOfRecurrence | integer | YES |  |  | 32 | 0 |
| StartDate | timestamp with time zone | NO |  |  |  |  |
| EndDate | timestamp with time zone | YES |  |  |  |  |
| NextRunDate | timestamp with time zone | NO |  |  |  |  |
| LastRunDate | timestamp with time zone | YES |  |  |  |  |
| IsActive | boolean | NO | true |  |  |  |
| Notes | text | YES |  |  |  |  |
| CreatedBy | integer | NO |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| UpdatedAt | timestamp with time zone | NO |  |  |  |  |

Foreign keys:
- `BranchId` → `Branches.Id` (on delete NO ACTION)
- `CustomerId` → `Customers.Id` (on delete CASCADE)
- `RouteId` → `Routes.Id` (on delete NO ACTION)

Indexes:
- `IX_RecurringInvoices_BranchId`
- `IX_RecurringInvoices_CustomerId`
- `IX_RecurringInvoices_RouteId`
- `PK_RecurringInvoices`

### RouteCustomers

Rows: 48. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| RouteId | integer | NO |  |  | 32 | 0 |
| CustomerId | integer | NO |  |  | 32 | 0 |
| AssignedAt | timestamp with time zone | NO |  |  |  |  |
| SortOrder | integer | YES |  |  | 32 | 0 |

Foreign keys:
- `CustomerId` → `Customers.Id` (on delete CASCADE)
- `RouteId` → `Routes.Id` (on delete CASCADE)

Indexes:
- `IX_RouteCustomers_CustomerId`
- `IX_RouteCustomers_RouteId`
- `IX_RouteCustomers_RouteId_CustomerId`
- `RouteCustomers_pkey`

### RouteExpenses

Rows: 0. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| RouteId | integer | NO |  |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| Category | text | NO |  |  |  |  |
| Amount | numeric | NO |  |  | 18 | 2 |
| ExpenseDate | timestamp with time zone | NO |  |  |  |  |
| Description | character varying | YES |  | 500 |  |  |
| CreatedBy | integer | NO |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |

Foreign keys:
- `CreatedBy` → `Users.Id` (on delete CASCADE)
- `RouteId` → `Routes.Id` (on delete CASCADE)
- `TenantId` → `Tenants.Id` (on delete CASCADE)

Indexes:
- `IX_RouteExpenses_CreatedBy`
- `IX_RouteExpenses_ExpenseDate`
- `IX_RouteExpenses_RouteId`
- `IX_RouteExpenses_TenantId`
- `RouteExpenses_pkey`

### RouteStaff

Rows: 4. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| RouteId | integer | NO |  |  | 32 | 0 |
| UserId | integer | NO |  |  | 32 | 0 |
| AssignedAt | timestamp with time zone | NO |  |  |  |  |

Foreign keys:
- `RouteId` → `Routes.Id` (on delete CASCADE)
- `UserId` → `Users.Id` (on delete CASCADE)

Indexes:
- `IX_RouteStaff_RouteId`
- `IX_RouteStaff_RouteId_UserId`
- `IX_RouteStaff_UserId`
- `RouteStaff_pkey`

### Routes

Rows: 6. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| BranchId | integer | NO |  |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| Name | character varying | NO |  | 200 |  |  |
| AssignedStaffId | integer | YES |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| UpdatedAt | timestamp with time zone | YES |  |  |  |  |
| IsActive | boolean | NO | true |  |  |  |

Foreign keys:
- `AssignedStaffId` → `Users.Id` (on delete SET NULL)
- `BranchId` → `Branches.Id` (on delete CASCADE)
- `TenantId` → `Tenants.Id` (on delete CASCADE)

Indexes:
- `IX_Routes_AssignedStaffId`
- `IX_Routes_BranchId`
- `IX_Routes_TenantId`
- `Routes_pkey`

### SalaryCertificates

Rows: 7. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO | nextval('"SalaryCertificates_Id_seq"'::regclass) |  | 32 | 0 |
| OwnerId | integer | NO |  |  | 32 | 0 |
| TenantId | integer | YES |  |  | 32 | 0 |
| CertificateNo | character varying | NO |  | 50 |  |  |
| CertificateDate | timestamp with time zone | NO |  |  |  |  |
| Recipient | character varying | YES |  | 200 |  |  |
| EmployeeName | character varying | YES |  | 200 |  |  |
| PassportNumber | character varying | YES |  | 50 |  |  |
| EmployeeNationality | character varying | YES |  | 100 |  |  |
| JoiningDate | timestamp with time zone | YES |  |  |  |  |
| Designation | character varying | YES |  | 200 |  |  |
| MonthlySalary | numeric | YES |  |  | 18 | 2 |
| MonthlySalaryWords | character varying | YES |  | 200 |  |  |
| EmployeePhone | character varying | YES |  | 50 |  |  |
| SignatoryName | character varying | NO | 'Sudheesh Thampi'::character varying | 200 |  |  |
| SignatoryTitle | character varying | NO | 'Manager'::character varying | 100 |  |  |
| Status | character varying | NO |  | 20 |  |  |
| Notes | text | YES |  |  |  |  |
| CreatedBy | integer | NO |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| LastModifiedBy | integer | YES |  |  | 32 | 0 |
| LastModifiedAt | timestamp with time zone | YES |  |  |  |  |
| IsDeleted | boolean | NO | false |  |  |  |
| DeletedBy | integer | YES |  |  | 32 | 0 |
| DeletedAt | timestamp with time zone | YES |  |  |  |  |

Indexes:
- `IX_SalaryCertificates_TenantId`
- `IX_SalaryCertificates_TenantId_CertificateNo`
- `SalaryCertificates_pkey`

### SaleItems

Rows: 6680. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| SaleId | integer | NO |  |  | 32 | 0 |
| ProductId | integer | NO |  |  | 32 | 0 |
| UnitType | character varying | NO |  | 20 |  |  |
| Qty | numeric | NO |  |  | 18 | 2 |
| UnitPrice | numeric | NO |  |  | 18 | 2 |
| Discount | numeric | NO |  |  | 18 | 2 |
| VatAmount | numeric | NO |  |  | 18 | 2 |
| LineTotal | numeric | NO |  |  | 18 | 2 |
| VatRate | numeric | NO | 0.0 |  | 18 | 4 |
| VatScenario | text | YES |  |  |  |  |
| UnitCostAtSale | numeric | YES |  |  | 18 | 6 |
| ConversionAtSale | numeric | YES |  |  | 18 | 6 |
| CostCapturedAt | timestamp with time zone | YES |  |  |  |  |

Foreign keys:
- `ProductId` → `Products.Id` (on delete CASCADE)
- `SaleId` → `Sales.Id` (on delete CASCADE)

Indexes:
- `IX_SaleItems_ProductId`
- `IX_SaleItems_SaleId`
- `PK_SaleItems`

### SaleReturnItems

Rows: 4. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| SaleReturnId | integer | NO |  |  | 32 | 0 |
| SaleItemId | integer | NO |  |  | 32 | 0 |
| ProductId | integer | NO |  |  | 32 | 0 |
| UnitType | character varying | NO |  | 20 |  |  |
| Qty | numeric | NO |  |  | 18 | 2 |
| UnitPrice | numeric | NO |  |  | 18 | 2 |
| VatAmount | numeric | NO |  |  | 18 | 2 |
| LineTotal | numeric | NO |  |  | 18 | 2 |
| Reason | character varying | YES |  | 200 |  |  |
| Condition | character varying | YES |  | 20 |  |  |
| DamageCategoryId | integer | YES |  |  | 32 | 0 |
| StockEffect | boolean | YES |  |  |  |  |

Foreign keys:
- `ProductId` → `Products.Id` (on delete CASCADE)
- `SaleItemId` → `SaleItems.Id` (on delete CASCADE)
- `SaleReturnId` → `SaleReturns.Id` (on delete CASCADE)

Indexes:
- `IX_SaleReturnItems_ProductId`
- `IX_SaleReturnItems_SaleItemId`
- `IX_SaleReturnItems_SaleReturnId`
- `PK_SaleReturnItems`

### SaleReturns

Rows: 4. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| OwnerId | integer | NO |  |  | 32 | 0 |
| TenantId | integer | YES |  |  | 32 | 0 |
| SaleId | integer | NO |  |  | 32 | 0 |
| CustomerId | integer | YES |  |  | 32 | 0 |
| ReturnNo | character varying | NO |  | 100 |  |  |
| ReturnDate | timestamp with time zone | NO |  |  |  |  |
| Subtotal | numeric | NO |  |  | 18 | 2 |
| VatTotal | numeric | NO |  |  | 18 | 2 |
| Discount | numeric | NO |  |  | 18 | 2 |
| GrandTotal | numeric | NO |  |  | 18 | 2 |
| Reason | character varying | YES |  | 500 |  |  |
| Status | text | NO |  |  |  |  |
| RestoreStock | boolean | NO |  |  |  |  |
| IsBadItem | boolean | NO |  |  |  |  |
| CreatedBy | integer | NO |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| BranchId | integer | YES |  |  | 32 | 0 |
| RouteId | integer | YES |  |  | 32 | 0 |
| ReturnCategory | character varying | YES |  | 20 |  |  |
| ReturnType | character varying | YES |  | 20 |  |  |
| RefundStatus | character varying | YES |  | 20 |  |  |

Foreign keys:
- `CreatedBy` → `Users.Id` (on delete CASCADE)
- `CustomerId` → `Customers.Id` (on delete NO ACTION)
- `SaleId` → `Sales.Id` (on delete CASCADE)

Indexes:
- `IX_SaleReturns_CreatedBy`
- `IX_SaleReturns_CustomerId`
- `IX_SaleReturns_SaleId`
- `IX_SaleReturns_TenantId_ReturnNo`
- `PK_SaleReturns`

### Sales

Rows: 1118. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| OwnerId | integer | NO |  |  | 32 | 0 |
| TenantId | integer | YES |  |  | 32 | 0 |
| InvoiceNo | character varying | NO |  | 100 |  |  |
| ExternalReference | character varying | YES |  | 200 |  |  |
| InvoiceDate | timestamp with time zone | NO |  |  |  |  |
| CustomerId | integer | YES |  |  | 32 | 0 |
| Subtotal | numeric | NO |  |  | 18 | 2 |
| VatTotal | numeric | NO |  |  | 18 | 2 |
| Discount | numeric | NO |  |  | 18 | 2 |
| GrandTotal | numeric | NO |  |  | 18 | 2 |
| TotalAmount | numeric | NO |  |  | 18 | 2 |
| PaidAmount | numeric | NO | 0.0 |  | 18 | 2 |
| PaymentStatus | text | NO |  |  |  |  |
| LastPaymentDate | timestamp with time zone | YES |  |  |  |  |
| DueDate | timestamp with time zone | YES |  |  |  |  |
| Notes | text | YES |  |  |  |  |
| CreatedBy | integer | NO |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| LastModifiedBy | integer | YES |  |  | 32 | 0 |
| LastModifiedAt | timestamp with time zone | YES |  |  |  |  |
| IsDeleted | boolean | NO | false |  |  |  |
| DeletedBy | integer | YES |  |  | 32 | 0 |
| DeletedAt | timestamp with time zone | YES |  |  |  |  |
| IsFinalized | boolean | NO |  |  |  |  |
| IsLocked | boolean | NO | false |  |  |  |
| LockedAt | timestamp with time zone | YES |  |  |  |  |
| EditReason | character varying | YES |  | 500 |  |  |
| Version | integer | NO | 1 |  | 32 | 0 |
| RowVersion | bytea | YES | '\x00'::bytea |  |  |  |
| BranchId | integer | YES |  |  | 32 | 0 |
| RouteId | integer | YES |  |  | 32 | 0 |
| IsZeroInvoice | boolean | NO | false |  |  |  |
| VatScenario | text | YES |  |  |  |  |
| RoundOff | numeric | NO | 0 |  |  |  |

Foreign keys:
- `BranchId` → `Branches.Id` (on delete SET NULL)
- `CreatedBy` → `Users.Id` (on delete CASCADE)
- `CustomerId` → `Customers.Id` (on delete NO ACTION)
- `DeletedBy` → `Users.Id` (on delete NO ACTION)
- `LastModifiedBy` → `Users.Id` (on delete NO ACTION)
- `RouteId` → `Routes.Id` (on delete SET NULL)

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

### Settings

Rows: 214. Primary key: Key, OwnerId.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Key | character varying | NO |  | 100 |  |  |
| OwnerId | integer | NO |  |  | 32 | 0 |
| TenantId | integer | YES |  |  | 32 | 0 |
| Value | text | YES |  |  |  |  |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| UpdatedAt | timestamp with time zone | NO |  |  |  |  |

Foreign keys:
- `TenantId` → `Tenants.Id` (on delete NO ACTION)

Indexes:
- `IX_Settings_OwnerId`
- `IX_Settings_TenantId`
- `PK_Settings`

### SubscriptionPlans

Rows: 1. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| Name | character varying | NO |  | 100 |  |  |
| Description | character varying | YES |  | 500 |  |  |
| MonthlyPrice | numeric | NO |  |  |  |  |
| YearlyPrice | numeric | NO |  |  |  |  |
| Currency | text | NO |  |  |  |  |
| MaxUsers | integer | NO |  |  | 32 | 0 |
| MaxInvoicesPerMonth | integer | NO |  |  | 32 | 0 |
| MaxCustomers | integer | NO |  |  | 32 | 0 |
| MaxProducts | integer | NO |  |  | 32 | 0 |
| MaxStorageMB | bigint | NO |  |  | 64 | 0 |
| HasAdvancedReports | boolean | NO |  |  |  |  |
| HasApiAccess | boolean | NO |  |  |  |  |
| HasWhiteLabel | boolean | NO |  |  |  |  |
| HasPrioritySupport | boolean | NO |  |  |  |  |
| HasCustomBranding | boolean | NO |  |  |  |  |
| TrialDays | integer | NO |  |  | 32 | 0 |
| IsActive | boolean | NO |  |  |  |  |
| DisplayOrder | integer | NO |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| UpdatedAt | timestamp with time zone | YES |  |  |  |  |

Indexes:
- `PK_SubscriptionPlans`

### Subscriptions

Rows: 6. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| PlanId | integer | NO |  |  | 32 | 0 |
| Status | integer | NO |  |  | 32 | 0 |
| BillingCycle | integer | NO |  |  | 32 | 0 |
| StartDate | timestamp with time zone | NO |  |  |  |  |
| EndDate | timestamp with time zone | YES |  |  |  |  |
| TrialEndDate | timestamp with time zone | YES |  |  |  |  |
| CancelledAt | timestamp with time zone | YES |  |  |  |  |
| CancellationReason | character varying | YES |  | 500 |  |  |
| ExpiresAt | timestamp with time zone | YES |  |  |  |  |
| NextBillingDate | timestamp with time zone | YES |  |  |  |  |
| Amount | numeric | NO |  |  | 18 | 2 |
| Currency | character varying | NO |  | 10 |  |  |
| PaymentGatewaySubscriptionId | character varying | YES |  | 200 |  |  |
| PaymentGatewayCustomerId | character varying | YES |  | 200 |  |  |
| PaymentMethod | character varying | YES |  | 50 |  |  |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| UpdatedAt | timestamp with time zone | YES |  |  |  |  |

Foreign keys:
- `PlanId` → `SubscriptionPlans.Id` (on delete CASCADE)
- `TenantId` → `Tenants.Id` (on delete CASCADE)

Indexes:
- `IX_Subscriptions_PlanId`
- `IX_Subscriptions_TenantId`
- `PK_Subscriptions`

### SupplierCategories

Rows: 0. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO | nextval('"SupplierCategories_Id_seq"'::regclass) |  | 32 | 0 |
| TenantId | integer | YES |  |  | 32 | 0 |
| Name | character varying | NO |  | 100 |  |  |
| IsActive | boolean | NO | true |  |  |  |
| CreatedAt | timestamp with time zone | NO | (now() AT TIME ZONE 'utc'::text) |  |  |  |

Indexes:
- `IX_SupplierCategories_TenantId_Name`
- `SupplierCategories_pkey`

### SupplierLedgerCredits

Rows: 18. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO | nextval('"SupplierLedgerCredits_Id_seq"'::regclass) |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| SupplierName | character varying | NO |  | 200 |  |  |
| Amount | numeric | NO |  |  | 18 | 2 |
| CreditDate | timestamp with time zone | NO |  |  |  |  |
| CreditType | character varying | NO |  | 50 |  |  |
| Notes | character varying | YES |  | 500 |  |  |
| CreatedBy | integer | NO |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO | (now() AT TIME ZONE 'utc'::text) |  |  |  |

Indexes:
- `IX_SupplierLedgerCredits_CreditDate`
- `IX_SupplierLedgerCredits_TenantId_SupplierName`
- `SupplierLedgerCredits_pkey`

### SupplierPayments

Rows: 27. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO | nextval('"SupplierPayments_Id_seq"'::regclass) |  | 32 | 0 |
| TenantId | integer | YES |  |  | 32 | 0 |
| SupplierId | integer | YES |  |  | 32 | 0 |
| Amount | numeric | NO |  |  | 18 | 2 |
| PaymentDate | timestamp with time zone | NO |  |  |  |  |
| Reference | character varying | YES |  | 200 |  |  |
| PurchaseId | integer | YES |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO | (now() AT TIME ZONE 'utc'::text) |  |  |  |
| SupplierName | character varying | YES |  | 200 |  |  |
| Mode | character varying | YES |  | 20 |  |  |
| Notes | character varying | YES |  | 500 |  |  |
| CreatedBy | integer | NO | 1 |  | 32 | 0 |

Foreign keys:
- `PurchaseId` → `Purchases.Id` (on delete SET NULL)
- `SupplierId` → `Suppliers.Id` (on delete RESTRICT)

Indexes:
- `IX_SupplierPayments_PaymentDate`
- `IX_SupplierPayments_PurchaseId`
- `IX_SupplierPayments_SupplierId`
- `SupplierPayments_pkey`

### Suppliers

Rows: 19. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO | nextval('"Suppliers_Id_seq"'::regclass) |  | 32 | 0 |
| TenantId | integer | YES |  |  | 32 | 0 |
| Name | character varying | NO |  | 200 |  |  |
| NormalizedName | character varying | NO |  | 200 |  |  |
| Phone | character varying | YES |  | 50 |  |  |
| Address | character varying | YES |  | 500 |  |  |
| CategoryId | integer | YES |  |  | 32 | 0 |
| OpeningBalance | numeric | NO | 0 |  | 18 | 2 |
| IsActive | boolean | NO | true |  |  |  |
| CreatedAt | timestamp with time zone | NO | (now() AT TIME ZONE 'utc'::text) |  |  |  |
| UpdatedAt | timestamp with time zone | YES |  |  |  |  |
| Email | character varying | YES |  | 200 |  |  |
| CreditLimit | numeric | NO | 0 |  | 18 | 2 |
| PaymentTerms | character varying | YES |  | 100 |  |  |
| SupplierCategoryId | integer | YES |  |  | 32 | 0 |

Foreign keys:
- `CategoryId` → `SupplierCategories.Id` (on delete SET NULL)

Indexes:
- `IX_Suppliers_CategoryId`
- `IX_Suppliers_TenantId_NormalizedName`
- `Suppliers_pkey`

### SupportSessions

Rows: 12. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| PlatformUserId | integer | NO |  |  | 32 | 0 |
| Reason | character varying | NO |  | 500 |  |  |
| StartedAt | timestamp with time zone | NO |  |  |  |  |
| ExpiresAt | timestamp with time zone | NO |  |  |  |  |
| EndedAt | timestamp with time zone | YES |  |  |  |  |
| ReadOnly | boolean | NO |  |  |  |  |

Foreign keys:
- `PlatformUserId` → `Users.Id` (on delete RESTRICT)
- `TenantId` → `Tenants.Id` (on delete CASCADE)

Indexes:
- `IX_SupportSessions_TenantId_PlatformUserId_ExpiresAt`
- `SupportSessions_pkey`

### TenantInvites

Rows: 3. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| UserId | integer | NO |  |  | 32 | 0 |
| TokenHash | character varying | NO |  | 128 |  |  |
| HostSubdomain | character varying | NO |  | 30 |  |  |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| ExpiresAt | timestamp with time zone | NO |  |  |  |  |
| UsedAt | timestamp with time zone | YES |  |  |  |  |
| RevokedAt | timestamp with time zone | YES |  |  |  |  |
| CreatedByUserId | integer | NO |  |  | 32 | 0 |

Foreign keys:
- `TenantId` → `Tenants.Id` (on delete CASCADE)
- `UserId` → `Users.Id` (on delete CASCADE)

Indexes:
- `IX_TenantInvites_TenantId_UserId_ExpiresAt`
- `IX_TenantInvites_TokenHash`
- `TenantInvites_pkey`

### TenantVatBasisHistory

Rows: 0. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| Basis | character varying | NO |  | 20 |  |  |
| EffectiveFrom | timestamp with time zone | NO |  |  |  |  |
| SetByUserId | integer | NO |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |

Foreign keys:
- `SetByUserId` → `Users.Id` (on delete RESTRICT)
- `TenantId` → `Tenants.Id` (on delete RESTRICT)

Indexes:
- `IX_TenantVatBasisHistory_SetByUserId`
- `IX_TenantVatBasisHistory_TenantId_EffectiveFrom`
- `PK_TenantVatBasisHistory`

### Tenants

Rows: 7. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| Name | character varying | NO |  | 200 |  |  |
| Subdomain | character varying | NO |  | 100 |  |  |
| Domain | character varying | YES |  | 200 |  |  |
| Country | character varying | NO | 'AE'::character varying | 10 |  |  |
| Currency | character varying | NO | 'AED'::character varying | 10 |  |  |
| VatNumber | character varying | YES |  | 50 |  |  |
| CompanyNameEn | character varying | YES |  | 200 |  |  |
| CompanyNameAr | character varying | YES |  | 200 |  |  |
| Address | character varying | YES |  | 500 |  |  |
| Phone | character varying | YES |  | 20 |  |  |
| Email | character varying | YES |  | 100 |  |  |
| LogoPath | character varying | YES |  | 500 |  |  |
| Status | text | NO | 'Active'::text |  |  |  |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| TrialEndDate | timestamp with time zone | YES |  |  |  |  |
| SuspendedAt | timestamp with time zone | YES |  |  |  |  |
| SuspensionReason | character varying | YES |  | 500 |  |  |
| FeaturesJson | character varying | YES |  | 2000 |  |  |
| VatCalculationBasis | character varying | NO | 'SalesBased'::character varying | 20 |  |  |

Indexes:
- `IX_Tenants_Domain`
- `IX_Tenants_Subdomain`
- `PK_Tenants`

### UserSessions

Rows: 442. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO | nextval('"UserSessions_Id_seq"'::regclass) |  | 32 | 0 |
| UserId | integer | NO |  |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| LoginAt | timestamp with time zone | NO |  |  |  |  |
| UserAgent | character varying | YES |  | 500 |  |  |
| IpAddress | character varying | YES |  | 45 |  |  |

Foreign keys:
- `UserId` → `Users.Id` (on delete CASCADE)

Indexes:
- `IX_UserSessions_LoginAt`
- `IX_UserSessions_TenantId`
- `UserSessions_pkey`

### Users

Rows: 22. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| Name | character varying | NO |  | 100 |  |  |
| Email | character varying | NO |  | 100 |  |  |
| PasswordHash | text | NO |  |  |  |  |
| Role | text | NO |  |  |  |  |
| OwnerId | integer | YES |  |  | 32 | 0 |
| TenantId | integer | YES |  |  | 32 | 0 |
| Phone | character varying | YES |  | 20 |  |  |
| DashboardPermissions | text | YES |  |  |  |  |
| CreatedAt | timestamp with time zone | NO |  |  |  |  |
| SessionVersion | integer | NO | 0 |  | 32 | 0 |
| ProfilePhotoUrl | character varying | YES |  | 500 |  |  |
| LanguagePreference | character varying | YES |  | 10 |  |  |
| LastLoginAt | timestamp with time zone | YES |  |  |  |  |
| LastActiveAt | timestamp with time zone | YES |  |  |  |  |
| PageAccess | character varying | YES |  | 500 |  |  |
| IsPlatformAdmin | boolean | NO | false |  |  |  |
| IsActive | boolean | NO | true |  |  |  |
| MustChangePassword | boolean | NO | false |  |  |  |

Foreign keys:
- `TenantId` → `Tenants.Id` (on delete NO ACTION)

Indexes:
- `IX_Users_TenantId`
- `IX_Users_TenantId_Email`
- `PK_Users`
- `idx_users_ownerid`

### VatReturnPeriods

Rows: 10. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO |  |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| PeriodType | text | NO |  |  |  |  |
| PeriodLabel | text | NO |  |  |  |  |
| PeriodStart | timestamp with time zone | NO |  |  |  |  |
| PeriodEnd | timestamp with time zone | NO |  |  |  |  |
| DueDate | timestamp with time zone | NO |  |  |  |  |
| Status | text | NO |  |  |  |  |
| Box1a | numeric | NO |  |  | 18 | 4 |
| Box1b | numeric | NO |  |  | 18 | 4 |
| Box2 | numeric | NO |  |  | 18 | 4 |
| Box3 | numeric | NO |  |  | 18 | 4 |
| Box4 | numeric | NO |  |  | 18 | 4 |
| Box9b | numeric | NO |  |  | 18 | 4 |
| Box10 | numeric | NO |  |  | 18 | 4 |
| Box11 | numeric | NO |  |  | 18 | 4 |
| Box12 | numeric | NO |  |  | 18 | 4 |
| Box13a | numeric | NO |  |  | 18 | 4 |
| Box13b | numeric | NO |  |  | 18 | 4 |
| PetroleumExcluded | numeric | NO |  |  | 18 | 4 |
| CalculatedAt | timestamp with time zone | YES |  |  |  |  |
| SubmittedAt | timestamp with time zone | YES |  |  |  |  |
| SubmittedByUserId | integer | YES |  |  | 32 | 0 |
| LockedAt | timestamp with time zone | YES |  |  |  |  |
| LockedByUserId | integer | YES |  |  | 32 | 0 |
| Notes | text | YES |  |  |  |  |
| SnapshotJson | text | YES |  |  |  |  |
| SnapshotHash | text | YES |  |  |  |  |
| SnapshotHistoryJson | text | YES |  |  |  |  |
| SnapshotVersion | integer | NO | 0 |  | 32 | 0 |
| SnapshotAt | timestamp with time zone | YES |  |  |  |  |
| CalculationVersion | integer | NO | 0 |  | 32 | 0 |
| SourceFingerprint | text | YES |  |  |  |  |
| ReviewedAt | timestamp with time zone | YES |  |  |  |  |
| ReviewedByUserId | integer | YES |  |  | 32 | 0 |
| ReviewedCalculationVersion | integer | YES |  |  | 32 | 0 |
| ReviewInvalidatedAt | timestamp with time zone | YES |  |  |  |  |
| ReviewInvalidatedReason | text | YES |  |  |  |  |

Indexes:
- `IX_VatReturnPeriods_TenantId`
- `IX_VatReturnPeriods_TenantId_PeriodStart_PeriodEnd`
- `PK_VatReturnPeriods`

### VendorDiscounts

Rows: 13. Primary key: Id.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| Id | integer | NO | nextval('"VendorDiscounts_Id_seq"'::regclass) |  | 32 | 0 |
| TenantId | integer | NO |  |  | 32 | 0 |
| SupplierId | integer | NO |  |  | 32 | 0 |
| PurchaseId | integer | YES |  |  | 32 | 0 |
| Amount | numeric | NO |  |  | 18 | 2 |
| DiscountDate | timestamp with time zone | NO |  |  |  |  |
| DiscountType | character varying | NO |  | 50 |  |  |
| Reason | character varying | NO | ''::character varying | 500 |  |  |
| IsActive | boolean | NO | true |  |  |  |
| CreatedBy | integer | NO |  |  | 32 | 0 |
| CreatedAt | timestamp with time zone | NO | (now() AT TIME ZONE 'utc'::text) |  |  |  |
| UpdatedAt | timestamp with time zone | NO | (now() AT TIME ZONE 'utc'::text) |  |  |  |

Foreign keys:
- `CreatedBy` → `Users.Id` (on delete CASCADE)
- `PurchaseId` → `Purchases.Id` (on delete SET NULL)
- `SupplierId` → `Suppliers.Id` (on delete RESTRICT)

Indexes:
- `IX_VendorDiscounts_CreatedBy`
- `IX_VendorDiscounts_PurchaseId`
- `IX_VendorDiscounts_SupplierId`
- `IX_VendorDiscounts_TenantId`
- `VendorDiscounts_pkey`

### __EFMigrationsHistory

Rows: 55. Primary key: MigrationId.

| Column | Type | Null | Default | Length | Precision | Scale |
|---|---|---|---|---|---|---|
| MigrationId | character varying | NO |  | 150 |  |  |
| ProductVersion | character varying | NO |  | 32 |  |  |

Indexes:
- `PK___EFMigrationsHistory`
