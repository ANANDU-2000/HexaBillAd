import { useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  HelpCircle, 
  BookOpen, 
  MessageCircle, 
  Mail, 
  Phone, 
  Search,
  FileText,
  CheckCircle,
  ArrowRight,
  MapPin,
  Users,
  Package,
  UserPlus,
  FilePlus
} from 'lucide-react'
// Layout removed - can be used by both tenant and SuperAdmin
import { Input } from '../components/Form'
import { useBranding } from '../contexts/TenantBrandingContext'

const HelpPage = () => {
  const { companyName } = useBranding()
  const [searchQuery, setSearchQuery] = useState('')

  const faqCategories = [
    {
      title: 'Getting Started',
      icon: <BookOpen className="h-5 w-5" />,
      questions: [
        {
          q: 'How do I create my first invoice?',
          a: 'Navigate to the POS page, add products to cart, select a customer, and click "Create Invoice". The invoice will be generated automatically with a unique invoice number.'
        },
        {
          q: 'How do I add products to my inventory?',
          a: 'Go to Products page, click "Add Product", fill in the product details including name, price, stock quantity, and VAT rate, then save.'
        },
        {
          q: 'How do I manage customers?',
          a: 'Visit the Customers page to add, edit, or view customer information. You can track customer balances and payment history from the Customer Ledger.'
        }
      ]
    },
    {
      title: 'Billing & Invoices',
      icon: <FileText className="h-5 w-5" />,
      questions: [
        {
          q: 'How do I customize my invoice header?',
          a: 'Go to Settings > Company Settings and update your company name (English and Arabic), address, phone, and VAT number. These will appear on all invoices.'
        },
        {
          q: 'Can I print invoices?',
          a: 'Yes! After creating an invoice, click the print button. You can choose to print directly or save as PDF.'
        },
        {
          q: 'How do I track payments?',
          a: 'Use the Payments page to record customer payments. The system automatically updates customer balances and invoice payment status.'
        }
      ]
    },
    {
      title: 'Reports & Analytics',
      icon: <CheckCircle className="h-5 w-5" />,
      questions: [
        {
          q: 'What reports are available?',
          a: 'You can view sales reports, profit reports, outstanding invoices, customer ledgers, and more from the Reports page.'
        },
        {
          q: 'How do I export data?',
          a: 'Most report pages have an export button that allows you to download data as Excel or CSV files.'
        }
      ]
    }
  ]

  const contactMethods = [
    {
      icon: <Mail className="h-5 w-5" />,
      title: 'Email Support',
      description: 'hexastack78@gmail.com',
      action: 'mailto:hexastack78@gmail.com'
    },
    {
      icon: <Phone className="h-5 w-5" />,
      title: 'Phone Support (India)',
      description: '+91 75919 99365',
      action: 'tel:+917591999365'
    },
    {
      icon: <MessageCircle className="h-5 w-5" />,
      title: 'Live Chat',
      description: 'Available 9 AM - 6 PM GST',
      action: '#'
    }
  ]

  const filteredFAQs = faqCategories.map(category => ({
    ...category,
    questions: category.questions.filter(q => 
      q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.a.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.questions.length > 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <HelpCircle className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Help & Support</h1>
              <p className="text-gray-600">Find answers and get help with {companyName}</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search for help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Getting started — mirrors OWNER_WORKFLOW.md */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-2 mb-4">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Getting started (recommended order)</h2>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Set up your company in this order: company & VAT first, then branches and routes, then staff, products, customers, and your first invoice.
          </p>
          <ol className="space-y-2">
            <li className="flex items-center gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 text-gray-700 text-xs font-medium flex items-center justify-center">1</span>
              <Link to="/settings" className="flex items-center gap-2 text-blue-600 hover:underline">
                Company info & VAT
                <ArrowRight className="h-4 w-4" />
              </Link>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 text-gray-700 text-xs font-medium flex items-center justify-center">2</span>
              <Link to="/branches" className="flex items-center gap-2 text-blue-600 hover:underline">
                Branches
                <MapPin className="h-4 w-4" />
                <ArrowRight className="h-4 w-4" />
              </Link>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 text-gray-700 text-xs font-medium flex items-center justify-center">3</span>
              <Link to="/branches" className="flex items-center gap-2 text-blue-600 hover:underline">
                Routes (optional)
                <ArrowRight className="h-4 w-4" />
              </Link>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 text-gray-700 text-xs font-medium flex items-center justify-center">4</span>
              <Link to="/users" className="flex items-center gap-2 text-blue-600 hover:underline">
                Users (staff)
                <Users className="h-4 w-4" />
                <ArrowRight className="h-4 w-4" />
              </Link>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 text-gray-700 text-xs font-medium flex items-center justify-center">5</span>
              <Link to="/products" className="flex items-center gap-2 text-blue-600 hover:underline">
                Products
                <Package className="h-4 w-4" />
                <ArrowRight className="h-4 w-4" />
              </Link>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 text-gray-700 text-xs font-medium flex items-center justify-center">6</span>
              <Link to="/purchases" className="flex items-center gap-2 text-blue-600 hover:underline">
                Purchases (optional)
                <ArrowRight className="h-4 w-4" />
              </Link>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 text-gray-700 text-xs font-medium flex items-center justify-center">7</span>
              <Link to="/customers" className="flex items-center gap-2 text-blue-600 hover:underline">
                Customers
                <UserPlus className="h-4 w-4" />
                <ArrowRight className="h-4 w-4" />
              </Link>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 text-gray-700 text-xs font-medium flex items-center justify-center">8</span>
              <Link to="/pos" className="flex items-center gap-2 text-blue-600 hover:underline">
                First invoice (POS or Sales Ledger)
                <FilePlus className="h-4 w-4" />
                <ArrowRight className="h-4 w-4" />
              </Link>
            </li>
          </ol>
        </div>

        {/* FAQ Categories */}
        {filteredFAQs.length > 0 && (
          <div className="space-y-6">
            {filteredFAQs.map((category, idx) => (
              <div key={idx} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="text-blue-600">{category.icon}</div>
                  <h2 className="text-xl font-semibold text-gray-900">{category.title}</h2>
                </div>
                <div className="space-y-4">
                  {category.questions.map((faq, qIdx) => (
                    <div key={qIdx} className="border-l-4 border-blue-500 pl-4">
                      <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                      <p className="text-gray-600 text-sm">{faq.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick tips — how to get the most out of HexaBill */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">How to get the most out of HexaBill</h2>
          <ul className="text-gray-600 text-sm space-y-1.5 list-disc list-inside">
            <li>Complete company & VAT in Settings first, then add branches and routes.</li>
            <li>Use the <strong>Get started</strong> checklist on the Dashboard to track setup progress.</li>
            <li>Use <strong>Reports</strong> for sales, profit, and aging to make data-driven decisions.</li>
            <li>Use <strong>Customer Ledger</strong> and <strong>Payments</strong> to track collections and cash flow.</li>
          </ul>
        </div>

        {/* Contact Support */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Contact Support</h2>
          <p className="text-gray-600 mb-5">
            Can't find what you're looking for? Our support team is here to help.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {contactMethods.map((method, idx) => (
              <a
                key={idx}
                href={method.action}
                className="p-5 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50/50 transition shadow-sm"
              >
                <div className="flex items-center space-x-3 mb-2">
                  <div className="text-blue-600">{method.icon}</div>
                  <h3 className="font-semibold text-gray-900">{method.title}</h3>
                </div>
                <p className="text-sm text-gray-600 font-medium">{method.description}</p>
              </a>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow p-6 text-white">
          <h2 className="text-xl font-semibold mb-4">Quick Links</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <a href="/feedback" className="flex items-center justify-between p-3 bg-white/10 rounded-lg hover:bg-white/20 transition">
              <span>Send Feedback</span>
              <ArrowRight className="h-5 w-5" />
            </a>
            <a href="/settings" className="flex items-center justify-between p-3 bg-white/10 rounded-lg hover:bg-white/20 transition">
              <span>Account Settings</span>
              <ArrowRight className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HelpPage
