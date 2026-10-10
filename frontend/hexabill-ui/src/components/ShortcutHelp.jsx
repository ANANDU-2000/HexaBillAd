import Modal from './Modal'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const MOD = isMac ? '⌘' : 'Ctrl'

const GROUPS = [
  {
    title: 'Anywhere',
    rows: [
      [`${MOD} K`, 'Search pages, customers, products, suppliers'],
      ['/', 'Focus the search box on this page'],
      [`${MOD} \\`, 'Collapse or expand the sidebar'],
      ['?', 'Show this list'],
      ['Esc', 'Close a dialog or menu'],
    ],
  },
  {
    title: 'Go to',
    rows: [
      ['F3', 'New bill (POS)'],
      ['F4', 'Purchases'],
      ['F7', 'Sales report'],
      ['F8', 'Profit & loss'],
      ['F9', 'Outstanding'],
      ['F10', 'Customer ledger'],
    ],
  },
]

const ShortcutHelp = ({ open, onClose }) => (
  <Modal isOpen={open} onClose={onClose} title="Keyboard shortcuts" size="md">
    <div className="space-y-5">
      {GROUPS.map((group) => (
        <section key={group.title}>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{group.title}</h4>
          <dl className="divide-y divide-surface-border rounded-md border border-surface-border">
            {group.rows.map(([keys, label]) => (
              <div key={keys} className="flex items-center justify-between gap-4 px-3 py-2 text-sm">
                <dt className="text-text-primary">{label}</dt>
                <dd>
                  <kbd className="whitespace-nowrap rounded border border-surface-border bg-neutral-50 px-1.5 py-0.5 font-sans text-xs text-text-secondary">{keys}</kbd>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <p className="text-xs text-neutral-500">Shortcuts are ignored while you type in a field. Some go-to keys need Admin or Owner access.</p>
    </div>
  </Modal>
)

export default ShortcutHelp
