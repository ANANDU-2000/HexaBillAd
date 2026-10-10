import { useState } from 'react'
import { Plus, Download, Receipt, Wallet, AlertTriangle, Users, Package, Search, Filter } from 'lucide-react'
import {
  PageHeader, Card, CardHeader, StatCard, Button, OverflowMenu, TabNavigation, ModernTable, Badge, Alert,
  EmptyState, ErrorState, ProgressBar, LoadingSkeleton, KpiSkeleton, TableSkeleton,
} from '../../components/ui'
import { Input, Select, TextArea } from '../../components/Form'
import Modal from '../../components/Modal'
import { MobileSheet } from '../../components/mobile'

/**
 * Dev-only reference page for the shared components (route /__design, DEV builds only).
 * Used by e2e/design-system.spec.js to check every component at 360–1440px.
 * Not linked from the app and excluded from production routing.
 */
const ROWS = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  invoice: `INV-2026-${String(1040 + i).padStart(5, '0')}`,
  customer: ['Al Noor Trading LLC', 'Gulf Fresh Foods', 'Blue Coast Cafeteria', 'مؤسسة النخيل للتجارة', 'Emirates Cold Store', 'Desert Rose Restaurant'][i],
  date: `0${i + 1}/10/2026`,
  status: ['Paid', 'Partial', 'Overdue', 'Paid', 'Draft', 'Partial'][i],
  total: [1250.5, 8420, 315.75, 12990, 0, 4410.2][i],
}))
const STATUS_TONE = { Paid: 'success', Partial: 'warning', Overdue: 'error', Draft: 'neutral' }
const money = (n) => `AED ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const Section = ({ id, title, children }) => (
  <section id={id} className="space-y-3" data-ds-section={id}>
    <h2 className="text-h3 font-semibold text-text-primary">{title}</h2>
    {children}
  </section>
)

export default function DesignSystemPage() {
  const [tab, setTab] = useState('all')
  const [page, setPage] = useState(3)
  const [modalOpen, setModalOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <main className="mx-auto w-full max-w-content px-4 py-6 md:px-6" data-testid="design-system">
      <PageHeader
        title="Design system"
        description="Shared HexaBill components rendered with sample data."
        showTitleOnMobile
        meta={<Badge variant="info" dot>Reference</Badge>}
        actions={
          <>
            <Button variant="secondary"><Download className="h-4 w-4" aria-hidden />Export</Button>
            <Button><Plus className="h-4 w-4" aria-hidden />New invoice</Button>
          </>
        }
      />

      <div className="space-y-10">
        <Section id="type" title="Typography">
          <Card className="space-y-2">
            <p className="text-display font-semibold tabular-nums">AED 1,284,560.00</p>
            <p className="text-h1 font-semibold">Heading 1 · 24px</p>
            <p className="text-h2 font-semibold">Heading 2 · 20px</p>
            <p className="text-h3 font-semibold">Heading 3 · 16px</p>
            <p className="text-body">Body 14px: the default for tables, forms and descriptions.</p>
            <p className="text-caption text-neutral-500">Caption 12px: hints, timestamps, meta.</p>
            <p className="text-micro text-neutral-500">Micro 11px: bottom-nav labels and keyboard hints only.</p>
            <p lang="ar" dir="rtl" className="text-body">فاتورة ضريبية · المجموع شامل ضريبة القيمة المضافة ٥٪</p>
          </Card>
        </Section>

        <Section id="kpi" title="Statistic cards">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard title="Sales today" value={18420.5} change={12.4} changeType="positive" icon={Receipt} />
            <StatCard title="Receivables" value={96210} change={-3.1} changeType="positive" changeLabel="vs last week" icon={Wallet} />
            <StatCard title="Overdue invoices" value={14} format="number" change={8} changeType="negative" icon={AlertTriangle} />
            <StatCard title="Customers" value={412} format="number" icon={Users} loading />
          </div>
        </Section>

        <Section id="buttons" title="Buttons">
          <Card className="flex flex-wrap items-center gap-2">
            <Button>Save invoice</Button>
            <Button variant="secondary">Cancel</Button>
            <Button variant="ghost">More</Button>
            <Button variant="outline">Preview</Button>
            <Button variant="danger">Delete</Button>
            <Button loading>Saving</Button>
            <Button disabled>Disabled</Button>
            <Button size="sm" variant="secondary">Small</Button>
            <Button variant="icon" aria-label="Search"><Search className="h-4 w-4" aria-hidden /></Button>
            <OverflowMenu items={[{ label: 'Duplicate', onClick: () => {} }, { label: 'Print', onClick: () => {} }, { label: 'Delete', danger: true, separatorBefore: true, onClick: () => {} }]} />
          </Card>
        </Section>

        <Section id="forms" title="Form fields">
          <Card variant="form">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="Customer name" placeholder="e.g. Al Noor Trading" required />
              <Input label="TRN" placeholder="15 digits" helperText="Tax registration number on the invoice." inputMode="numeric" />
              <Select label="Payment method" options={[{ value: 'cash', label: 'Cash' }, { value: 'card', label: 'Card' }, { value: 'bank', label: 'Bank transfer' }]} />
              <Input label="Amount" defaultValue="-50" error="Amount must be greater than zero." />
              <Input label="Read only" value="INV-2026-01040" readOnly />
              <Input label="Disabled" value="Locked after VAT filing" disabled />
              <div className="md:col-span-2">
                <TextArea label="Notes" placeholder="Shown on the printed invoice" />
              </div>
            </div>
          </Card>
        </Section>

        <Section id="badges" title="Status badges and alerts">
          <Card className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="success" dot>Paid</Badge>
              <Badge variant="warning" dot>Partial</Badge>
              <Badge variant="error" dot>Overdue</Badge>
              <Badge variant="info">Synced</Badge>
              <Badge>Draft</Badge>
            </div>
            <Alert tone="info" title="VAT period closes in 5 days">File the return before 28 Oct to avoid penalties.</Alert>
            <Alert tone="success">Payment of AED 1,250.50 recorded.</Alert>
            <Alert tone="warning" title="Low stock" action={<Button size="sm" variant="secondary">Review</Button>}>12 products are below their reorder level.</Alert>
            <Alert tone="error" onDismiss={() => {}}>The invoice could not be saved. Check your connection and try again.</Alert>
          </Card>
        </Section>

        <Section id="table" title="Data table (cards below 768px)">
          <TabNavigation
            activeTab={tab}
            onChange={setTab}
            tabs={[
              { id: 'all', label: 'All invoices', badge: 128 },
              { id: 'unpaid', label: 'Unpaid', badge: 14 },
              { id: 'overdue', label: 'Overdue', badge: 3 },
              { id: 'drafts', label: 'Drafts' },
              { id: 'returns', label: 'Returns' },
            ]}
          />
          <ModernTable
            mobileCards
            caption="Invoices"
            data={ROWS}
            onRowClick={() => {}}
            actions={() => <Button size="sm" variant="ghost">View</Button>}
            columns={[
              { key: 'invoice', label: 'Invoice', sortable: true, mobile: 'title' },
              { key: 'customer', label: 'Customer', sortable: true, mobile: 'subtitle' },
              { key: 'date', label: 'Date' },
              { key: 'status', label: 'Status', render: (r) => <Badge variant={STATUS_TONE[r.status]} dot size="sm">{r.status}</Badge> },
              { key: 'total', label: 'Total', align: 'right', sortable: true, render: (r) => money(r.total) },
            ]}
            pagination={{ currentPage: page, totalPages: 24, onPageChange: setPage }}
          />
          <ModernTable mobileCards data={[]} columns={[{ key: 'a', label: 'Name' }]} emptyTitle="No invoices match these filters" emptyDescription="Clear the filters or create a new invoice." emptyAction={{ label: 'Clear filters', onClick: () => {} }} />
        </Section>

        <Section id="states" title="Empty, error and loading">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Card variant="table"><EmptyState icon={Package} title="No products yet" description="Add your first product to start selling." primaryAction={{ label: 'Add product', icon: Plus, onClick: () => {} }} /></Card>
            <Card variant="table"><ErrorState message="The sales report could not be loaded." onAction={() => {}} /></Card>
          </div>
          <KpiSkeleton />
          <TableSkeleton rows={3} />
          <LoadingSkeleton variant="line" count={2} />
          <Card><ProgressBar label="Importing products" value={64} /></Card>
        </Section>

        <Section id="overlays" title="Dialogs and sheets">
          <Card className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(true)} data-testid="open-modal">Open dialog</Button>
            <Button variant="secondary" onClick={() => setSheetOpen(true)} data-testid="open-sheet"><Filter className="h-4 w-4" aria-hidden />Open filter sheet</Button>
          </Card>
        </Section>

        <Section id="brand" title="Tenant brand accent">
          <Card>
            <CardHeader title="Identity accent" description="--tenant-brand: logo monogram and document rule only." />
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-tenant text-sm font-semibold text-white">GH</span>
              <div className="h-1 flex-1 rounded-full bg-tenant" />
            </div>
          </Card>
        </Section>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record payment"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={() => setModalOpen(false)}>Save payment</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Amount" inputMode="decimal" defaultValue="1250.50" />
          <Select label="Method" options={[{ value: 'cash', label: 'Cash' }, { value: 'bank', label: 'Bank transfer' }]} />
        </div>
      </Modal>

      <MobileSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filter invoices"
        footer={<Button className="w-full" onClick={() => setSheetOpen(false)}>Apply filters</Button>}
      >
        <div className="space-y-4 p-4">
          <Select label="Status" options={[{ value: '', label: 'Any' }, { value: 'paid', label: 'Paid' }]} />
          <Input label="From date" type="date" />
          <Input label="To date" type="date" />
        </div>
      </MobileSheet>
    </main>
  )
}
