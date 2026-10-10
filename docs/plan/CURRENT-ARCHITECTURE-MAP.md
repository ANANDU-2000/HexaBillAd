# Current architecture map

Generated8Oct2026 from App.jsx import/route declarations;61 unique patterns match the manifest. Static map; runtime role/permission and endpoint acceptance remain separate. Branch release-1 startingbdcc429 plus current local edits.

| Route | Component source |
|---|---|
| `*` | ErrorPage: frontend/hexabill-ui/src/pages/ErrorPage |
| `/` | Redirect/fallback/conditional route; inspect App.jsx |
| `/Admin26` | Login: frontend/hexabill-ui/src/auth/Login |
| `/agreements` | AgreementsPage: frontend/hexabill-ui/src/features/documents/AgreementsPage |
| `/agreements/:id` | AgreementEditorPage: frontend/hexabill-ui/src/features/documents/AgreementEditorPage |
| `/agreements/new` | AgreementEditorPage: frontend/hexabill-ui/src/features/documents/AgreementEditorPage |
| `/audit` | AuditLogPage: frontend/hexabill-ui/src/pages/company/AuditLogPage |
| `/backup` | BackupPage: frontend/hexabill-ui/src/pages/company/BackupPage |
| `/billing-history` | BillingHistoryPage: frontend/hexabill-ui/src/features/sales/BillingHistoryPage |
| `/branches` | BranchesPage: frontend/hexabill-ui/src/features/branches/BranchesPage |
| `/branches/:id` | BranchDetailPage: frontend/hexabill-ui/src/features/branches/BranchDetailPage |
| `/customers` | CustomersPage: frontend/hexabill-ui/src/features/customers/CustomersPage |
| `/customers/:id` | CustomerDetailPage: frontend/hexabill-ui/src/features/customers/CustomerDetailPage |
| `/daily-close` | DailyClosePage: frontend/hexabill-ui/src/features/dailyClose/DailyClosePage |
| `/dashboard` | Dashboard: frontend/hexabill-ui/src/features/dashboard/DashboardTally |
| `/delivery-notes` | DeliveryNotesPage: frontend/hexabill-ui/src/features/sales/DeliveryNotesPage |
| `/delivery-notes/:saleId` | DeliveryNoteViewPage: frontend/hexabill-ui/src/features/sales/DeliveryNoteViewPage |
| `/expenses` | ExpensesPage: frontend/hexabill-ui/src/features/expenses/ExpensesPage |
| `/feedback` | FeedbackPage: frontend/hexabill-ui/src/pages/FeedbackPage |
| `/help` | HelpPage: frontend/hexabill-ui/src/pages/HelpPage |
| `/ledger` | CustomerLedgerPage: frontend/hexabill-ui/src/features/customers/CustomerLedgerPage |
| `/login` | Login: frontend/hexabill-ui/src/auth/Login |
| `/more` | MorePage: frontend/hexabill-ui/src/pages/company/MorePage |
| `/onboarding` | OnboardingWizard: frontend/hexabill-ui/src/pages/OnboardingWizard |
| `/pos` | PosPage: frontend/hexabill-ui/src/features/sales/PosPage |
| `/pricelist` | PriceList: frontend/hexabill-ui/src/features/products/PriceList |
| `/products` | ProductsPage: frontend/hexabill-ui/src/features/products/ProductsPage |
| `/products/:id` | ProductDetailPage: frontend/hexabill-ui/src/features/products/ProductDetailPage |
| `/profile` | ProfilePage: frontend/hexabill-ui/src/pages/company/ProfilePage |
| `/purchases` | PurchasesPage: frontend/hexabill-ui/src/features/purchases/PurchasesPage |
| `/quotations` | QuotationsPage: frontend/hexabill-ui/src/features/documents/QuotationsPage |
| `/quotations/:id` | QuotationEditorPage: frontend/hexabill-ui/src/features/documents/QuotationEditorPage |
| `/quotations/new` | QuotationEditorPage: frontend/hexabill-ui/src/features/documents/QuotationEditorPage |
| `/recurring-invoices` | Redirect/fallback/conditional route; inspect App.jsx |
| `/reports` | ReportsPage: frontend/hexabill-ui/src/features/reports/ReportsPage |
| `/reports/outstanding` | ReportsPage: frontend/hexabill-ui/src/features/reports/ReportsPage |
| `/returns/create` | ReturnCreatePage: frontend/hexabill-ui/src/features/returns/ReturnCreatePage |
| `/routes` | RoutesPage: frontend/hexabill-ui/src/features/branches/RoutesPage |
| `/routes/:id` | RouteDetailPage: frontend/hexabill-ui/src/features/branches/RouteDetailPage |
| `/salary-certificates` | SalaryCertificatesPage: frontend/hexabill-ui/src/features/documents/SalaryCertificatesPage |
| `/salary-certificates/:id` | SalaryCertificateEditorPage: frontend/hexabill-ui/src/features/documents/SalaryCertificateEditorPage |
| `/salary-certificates/new` | SalaryCertificateEditorPage: frontend/hexabill-ui/src/features/documents/SalaryCertificateEditorPage |
| `/sales-ledger` | SalesLedgerPage: frontend/hexabill-ui/src/features/sales/SalesLedgerPage |
| `/settings` | SettingsPage: frontend/hexabill-ui/src/features/settings/SettingsPage |
| `/signup` | SignupPage: frontend/hexabill-ui/src/auth/SignupPage |
| `/stock-adjustments` | StockAdjustmentsHistoryPage: frontend/hexabill-ui/src/features/inventory/StockAdjustmentsHistoryPage |
| `/superadmin/audit-logs` | SuperAdminAuditLogsPage: frontend/hexabill-ui/src/platform/SuperAdminAuditLogsPage |
| `/superadmin/dashboard` | SuperAdminDashboard: frontend/hexabill-ui/src/platform/SuperAdminDashboard |
| `/superadmin/demo-requests` | SuperAdminDemoRequestsPage: frontend/hexabill-ui/src/platform/SuperAdminDemoRequestsPage |
| `/superadmin/error-logs` | SuperAdminErrorLogsPage: frontend/hexabill-ui/src/platform/SuperAdminErrorLogsPage |
| `/superadmin/health` | SuperAdminHealthPage: frontend/hexabill-ui/src/platform/SuperAdminHealthPage |
| `/superadmin/search` | SuperAdminGlobalSearchPage: frontend/hexabill-ui/src/platform/SuperAdminGlobalSearchPage |
| `/superadmin/settings` | SuperAdminSettingsPage: frontend/hexabill-ui/src/platform/SuperAdminSettingsPage |
| `/superadmin/sql-console` | SuperAdminSqlConsolePage: frontend/hexabill-ui/src/platform/SuperAdminSqlConsolePage |
| `/superadmin/tenants` | SuperAdminTenantsPage: frontend/hexabill-ui/src/platform/SuperAdminTenantsPage |
| `/superadmin/tenants/:id` | SuperAdminTenantDetailPage: frontend/hexabill-ui/src/platform/SuperAdminTenantDetailPage |
| `/suppliers` | SuppliersPage: frontend/hexabill-ui/src/features/purchases/SuppliersPage |
| `/suppliers/:name` | SupplierDetailPage: frontend/hexabill-ui/src/features/purchases/SupplierDetailPage |
| `/users` | UsersPage: frontend/hexabill-ui/src/pages/company/UsersPage |
| `/vat-return` | VatReturnPage: frontend/hexabill-ui/src/features/reports/VatReturnPage |
| `/worksheet` | WorksheetPage: frontend/hexabill-ui/src/features/reports/WorksheetPage |

## Reviewed traces

- Login: auth/Login.jsx -> authAPI/useAuth -> AuthController -> lockout/AuthService -> verified TenantHostMiddleware -> tenant/email Users query, fresh Tenants status, BCrypt, UserSessions/settings/assignments -> JWT/route/dashboard. Stage timings are local Development header and structured server logs.
- Sale: PosPage chooses enterprise/legacy -> salesAPI -> SalesController -> SaleService -> invoice-number transaction/guards/validation -> products/stock/Sales/SaleItems/payments/balance -> postcommit PDF -> response. Per-stage runtime matrix open.
- Payments/receipts: PaymentsPage/CustomerLedgerPage/PaymentModal -> paymentsAPI -> PaymentsController/PaymentService -> transaction idempotency/allocation/balance -> PaymentReceiptService -> ReceiptPreviewModal/print/PDF. Current-header/financial-snapshot policy preserved.
- Cross-cutting: ASP.NET/EF PostgreSQL production model; SQLite and PG EnsureCreated tests; initialization/readiness gating; R2/local files; role/tenant query/write guards. Existing startup/migration collisions remain separate release risks.

Controllers/services inventory:
- Auth: controllers AuthController.cs; services AuthService.cs, LoginLockoutService.cs, SignupService.cs.
- Automation: controllers none in top level; services none in top level.
- Branches: controllers BranchesController.cs, CustomerVisitsController.cs, RouteExpensesController.cs, RoutesController.cs; services BranchService.cs, RouteService.cs.
- Customers: controllers CustomersController.cs; services BalanceService.cs, CustomerItemPriceService.cs, CustomerMergeService.cs, CustomerService.cs.
- DailyClose: controllers DailyCloseController.cs; services DailyCloseService.cs.
- Documents: controllers AgreementsController.cs, QuotationsController.cs, SalaryCertificatesController.cs; services AgreementService.cs, QuotationService.cs, QuoteNumberService.cs, SalaryCertificateService.cs.
- Expenses: controllers ExpensesController.cs; services ExpenseService.cs.
- Import: controllers SalesLedgerImportController.cs; services SalesLedgerImportService.cs.
- Inventory: controllers StockAdjustmentsController.cs; services StockAdjustmentService.cs.
- Notifications: controllers AlertsController.cs; services AlertCheckBackgroundService.cs, AlertService.cs.
- Payments: controllers PaymentsController.cs; services PaymentReceiptService.cs, PaymentService.cs.
- Products: controllers ProductCategoriesController.cs, ProductsController.cs; services ExcelImportService.cs, ProductBarcodeLabelService.cs, ProductSeedService.cs, ProductService.cs.
- Public: controllers TenantContextController.cs; services none in top level.
- Purchases: controllers PurchasesController.cs, SuppliersController.cs; services PurchaseService.cs, SupplierMergeService.cs, SupplierService.cs.
- Reports: controllers ProfitController.cs, ReportsController.cs; services ProfitService.cs, ReportService.cs, VatReturnReportService.cs, VatReturnValidationService.cs.
- Returns: controllers ReturnsController.cs; services ReturnService.cs.
- Sales: controllers InvoiceTemplatesController.cs, RecurringInvoicesController.cs, SalesController.cs; services InvoiceNumberService.cs, InvoiceTemplateService.cs, IPdfService.cs, PdfService.cs, RecurringInvoiceService.cs, SaleService.cs, SaleValidationService.cs, SimplePdfService.cs.
- Seed: controllers SeedController.cs; services none in top level.
- Subscription: controllers SubscriptionController.cs; services SubscriptionService.cs.
- SuperAdmin: controllers BackupAgentController.cs, BackupController.cs, DashboardController.cs, DemoRequestController.cs, DiagnosticsController.cs, GlobalSearchController.cs, PlatformSettingsController.cs, ResetController.cs, SettingsController.cs, SqlConsoleController.cs, StorageController.cs, SuperAdminController.cs, SupportSessionsController.cs; services BackupAgentService.cs, BackupService.cs, ComprehensiveBackupService.cs, DemoRequestService.cs, DocumentAssetUploadService.cs, LogoUploadService.cs, ResetService.cs, SettingsService.cs, StartupDiagnosticsService.cs.
- Tenants: controllers SuperAdminTenantController.cs; services SuperAdminTenantService.cs.
- Users: controllers UsersController.cs; services none in top level.
- VendorDiscounts: controllers VendorDiscountsController.cs; services IVendorDiscountService.cs, VendorDiscountService.cs.
