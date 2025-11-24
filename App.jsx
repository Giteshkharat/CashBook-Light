import React, { useState, useEffect, useRef } from 'react'
import {
  initializeApp
} from 'firebase/app'
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth'
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  doc,
  serverTimestamp
} from 'firebase/firestore'
import {
  Pencil,
  Trash,
  Lock,
  Mic,
  Home,
  PieChart,
  PlusCircle,
  FileText,
  Share2,
  LogOut
} from 'lucide-react'
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  Tooltip,
  Legend
} from 'recharts'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { format } from 'date-fns'

// ---------------------------
// Firebase Configuration
// Actual Firebase project config provided by user
const firebaseConfig = {
  apiKey: "AIzaSyCSH-ekfLr2FoZ03Pj63liLH512nuIQvBs",
  authDomain: "cashbook-light.firebaseapp.com",
  projectId: "cashbook-light",
  storageBucket: "cashbook-light.firebasestorage.app",
  messagingSenderId: "849439629626",
  appId: "1:849439629626:web:52aa98a529e7ab846fb003",
  measurementId: "G-G5SKJWCXYQ"
}
// Initialize Firebase app
const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

// Utility: Indian currency formatter with ₹ and Indian-style digit grouping
const formatIndianCurrency = (amount) => {
  if (typeof amount !== 'number') return '₹0'
  // Format amount with Indian comma style and ₹ prefix
  // https://stackoverflow.com/a/55542604
  const x = amount.toFixed(2).toString()
  const afterPoint = x.indexOf('.') > 0 ? x.substring(x.indexOf('.'), x.length) : ''
  let num = x.indexOf('.') > 0 ? x.substring(0, x.indexOf('.')) : x
  let lastThree = num.substring(num.length - 3)
  const otherNumbers = num.substring(0, num.length - 3)
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree
  }
  const res =
    otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree + afterPoint
  return `₹${res}`
}

// Categories example (can be expanded)
const categories = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Other'
]

// Transaction types
const transactionTypes = ['IN', 'OUT']

// Minimum touch size for buttons in px (44px)
const BUTTON_HEIGHT = 44

// Colors for categories for the pie chart
const CATEGORY_COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#A28CFF',
  '#FF66A3',
  '#CCCCCC'
]

// ---------------------------
// Authentication Component
function Auth({ onUserLoggedIn }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const switchMode = () => {
    setError(null)
    setMode(mode === 'login' ? 'signup' : 'login')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password)
        onUserLoggedIn(userCredential.user)
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password)
        onUserLoggedIn(userCredential.user)
      }
    } catch (err) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen p-6 bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <h2 className="text-2xl font-bold mb-6 text-center">
          {mode === 'login' ? 'Login' : 'Sign Up'}
        </h2>
        {error && (
          <div className="mb-4 text-red-600 font-semibold text-center">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            required
            placeholder="Email"
            className="p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            aria-label="Email"
          />
          <input
            type="password"
            required
            placeholder="Password"
            className="p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            aria-label="Password"
          />
          <button
            type="submit"
            className="bg-indigo-600 text-white py-3 rounded hover:bg-indigo-700 transition-colors disabled:bg-indigo-300"
            disabled={loading}
            style={{ minHeight: BUTTON_HEIGHT }}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Sign Up'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          {mode === 'login'
            ? "Don't have an account? "
            : 'Already have an account? '}
          <button
            onClick={switchMode}
            className="text-indigo-600 underline focus:outline-none"
            aria-label="Switch login/signup mode"
          >
            {mode === 'login' ? 'Sign Up' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  )
}

// ---------------------------
// TransactionRow Component
function TransactionRow({ transaction, currentUser, onEdit, onDelete }) {
  const { userId, userName, amount, remark, type, category, createdAt } = transaction
  const isOwnEntry = currentUser && userId === currentUser.uid

  return (
    <div
      className={`rounded-md p-4 mb-3 flex flex-col md:flex-row md:items-center md:justify-between ${
        isOwnEntry ? 'bg-white' : 'bg-blue-50'
      }`}
      style={{ minHeight: 60 }}
    >
      <div className="flex flex-col md:flex-row md:items-center md:space-x-4 flex-1">
        <div className="font-semibold">
          {remark || '(No Remark)'}
        </div>
        <div className="text-sm text-gray-600">
          {userName && !isOwnEntry ? `Added by ${userName}` : ''}
        </div>
        <div className="bg-blue-200 text-blue-900 rounded px-2 py-1 ml-2 text-xs font-semibold w-max">
          {category || 'Other'}
        </div>
      </div>
      <div className="flex items-center space-x-4 mt-3 md:mt-0">
        <div
          className={`font-bold text-lg ${
            type === 'IN' ? 'text-green-700' : 'text-red-700'
          } min-w-[100px] text-right`}
          aria-label={`Amount in rupees: ${amount}`}
        >
          {formatIndianCurrency(amount)}
        </div>
        <div className="text-xs text-gray-500 whitespace-nowrap">
          {createdAt && createdAt.seconds
            ? format(new Date(createdAt.seconds * 1000), 'dd MMM yyyy, hh:mm a')
            : ''}
        </div>
        {isOwnEntry ? (
          <>
            <button
              onClick={() => onEdit(transaction)}
              aria-label="Edit transaction"
              className="p-2 hover:bg-gray-200 rounded focus:outline-none"
              style={{ minHeight: BUTTON_HEIGHT }}
            >
              <Pencil size={18} />
            </button>
            <button
              onClick={() => onDelete(transaction)}
              aria-label="Delete transaction"
              className="p-2 hover:bg-red-200 rounded focus:outline-none"
              style={{ minHeight: BUTTON_HEIGHT }}
            >
              <Trash size={18} />
            </button>
          </>
        ) : (
          <div
            className="flex items-center space-x-1 text-gray-500 select-none"
            aria-label="Partner's entry locked"
          >
            <Lock size={16} />
            <span className="text-xs">Added by {userName || 'Partner'}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------
// Add/Edit Modal Component
function TransactionModal({
  currentUser,
  categories,
  show,
  onClose,
  onSave,
  editTransaction
}) {
  const [amount, setAmount] = useState('')
  const [remark, setRemark] = useState('')
  const [type, setType] = useState('OUT')
  const [category, setCategory] = useState(categories[0])
  const [saving, setSaving] = useState(false)

  const amountInputRef = useRef(null)
  const remarkInputRef = useRef(null)

  // Reset form on open/close
  useEffect(() => {
    if (show) {
      if (editTransaction) {
        setAmount(editTransaction.amount.toString())
        setRemark(editTransaction.remark || '')
        setType(editTransaction.type)
        setCategory(editTransaction.category || categories[0])
      } else {
        setAmount('')
        setRemark('')
        setType('OUT')
        setCategory(categories[0])
      }
    }
  }, [show, editTransaction, categories])

  // Voice input integration for amount and remark
  const handleVoiceInput = (field) => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech Recognition not supported in this browser.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.start()
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim()
      if (field === 'amount') {
        // Clean transcript to digits only for safety
        const digits = transcript.replace(/[^\d.]/g, '')
        setAmount(digits)
      } else if (field === 'remark') {
        setRemark(transcript)
      }
    }
    recognition.onerror = (event) => {
      alert('Error with speech recognition: ' + event.error)
    }
  }

  // Handle save transaction to Firestore
  const handleSave = async () => {
    if (!currentUser) return
    if (!amount || isNaN(parseFloat(amount))) {
      alert('Please enter a valid amount')
      return
    }
    setSaving(true)
    try {
      if (editTransaction) {
        // update existing doc
        const docRef = doc(db, 'transactions', editTransaction.id)
        await updateDoc(docRef, {
          amount: parseFloat(amount),
          remark: remark.trim(),
          type,
          category,
          createdAt: serverTimestamp()
        })
      } else {
        // add new doc
        await addDoc(collection(db, 'transactions'), {
          userId: currentUser.uid,
          userEmail: currentUser.email,
          userName: currentUser.displayName || currentUser.email,
          amount: parseFloat(amount),
          remark: remark.trim(),
          type,
          category,
          createdAt: serverTimestamp()
        })
      }
      onSave()
    } catch (err) {
      alert('Error saving transaction: ' + err.message)
    }
    setSaving(false)
  }

  if (!show) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg max-w-md w-full p-6 relative shadow-lg">
        <h3 className="text-xl font-semibold mb-4">
          {editTransaction ? 'Edit Transaction' : 'Add Transaction'}
        </h3>
        <div className="flex flex-col space-y-4">
          <div>
            <label htmlFor="amount" className="block mb-1 font-medium">
              Amount
            </label>
            <div className="relative">
              <input
                id="amount"
                type="tel"
                inputMode="decimal"
                aria-label="Transaction amount"
                className="w-full border border-gray-300 rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                ref={amountInputRef}
                min="0"
              />
              <button
                type="button"
                onClick={() => handleVoiceInput('amount')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-indigo-600 hover:text-indigo-900 focus:outline-none"
                aria-label="Voice input for amount"
                style={{ minHeight: BUTTON_HEIGHT, minWidth: BUTTON_HEIGHT }}
              >
                <Mic size={20} />
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="remark" className="block mb-1 font-medium">
              Remark
            </label>
            <div className="relative">
              <input
                id="remark"
                type="text"
                aria-label="Transaction remark"
                className="w-full border border-gray-300 rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                ref={remarkInputRef}
              />
              <button
                type="button"
                onClick={() => handleVoiceInput('remark')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-indigo-600 hover:text-indigo-900 focus:outline-none"
                aria-label="Voice input for remark"
                style={{ minHeight: BUTTON_HEIGHT, minWidth: BUTTON_HEIGHT }}
              >
                <Mic size={20} />
              </button>
            </div>
          </div>

          <div className="flex space-x-4 items-center">
            <div className="flex-1">
              <label htmlFor="type" className="block mb-1 font-medium">
                Type
              </label>
              <select
                id="type"
                value={type}
                aria-label="Transaction type"
                onChange={(e) => setType(e.target.value)}
                className="w-full border border-gray-300 rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {transactionTypes.map((tt) => (
                  <option key={tt} value={tt}>
                    {tt}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label htmlFor="category" className="block mb-1 font-medium">
                Category
              </label>
              <select
                id="category"
                aria-label="Transaction category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-gray-300 rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-100 focus:outline-none"
              style={{ minHeight: BUTTON_HEIGHT }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 focus:outline-none disabled:bg-indigo-300"
              disabled={saving}
              style={{ minHeight: BUTTON_HEIGHT }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------
// Floating Glass Dock Component
function FloatingDock({
  onHomeClick,
  onAnalyticsClick,
  onAddClick,
  onPDFClick,
  onWhatsAppClick,
  activeView
}) {
  // Styling: glassmorphism effect
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 mx-auto max-w-4xl p-3 flex justify-around items-center bg-white bg-opacity-60 backdrop-blur-md
                 rounded-t-xl shadow-lg border-t border-gray-200 z-40"
      aria-label="Floating navigation dock"
      style={{ paddingBottom: 24 }}
    >
      <button
        aria-pressed={activeView === 'home'}
        onClick={onHomeClick}
        className={`flex flex-col items-center justify-center text-indigo-700 focus:outline-none ${
          activeView === 'home' ? 'font-bold' : 'font-normal'
        }`}
        style={{ minHeight: BUTTON_HEIGHT, minWidth: BUTTON_HEIGHT }}
        aria-label="Home"
      >
        <Home size={24} />
        <span className="text-xs mt-1">Home</span>
      </button>
      <button
        aria-pressed={activeView === 'analytics'}
        onClick={onAnalyticsClick}
        className={`flex flex-col items-center justify-center text-indigo-700 focus:outline-none ${
          activeView === 'analytics' ? 'font-bold' : 'font-normal'
        }`}
        style={{ minHeight: BUTTON_HEIGHT, minWidth: BUTTON_HEIGHT }}
        aria-label="Analytics"
      >
        <PieChart size={24} />
        <span className="text-xs mt-1">Analytics</span>
      </button>
      <button
        onClick={onAddClick}
        aria-label="Add new transaction"
        className="flex flex-col items-center justify-center text-green-600 focus:outline-none"
        style={{ minHeight: BUTTON_HEIGHT, minWidth: BUTTON_HEIGHT }}
      >
        <PlusCircle size={28} />
        <span className="text-xs mt-1">Add</span>
      </button>
      <button
        onClick={onPDFClick}
        aria-label="Export to PDF"
        className="flex flex-col items-center justify-center text-gray-700 focus:outline-none"
        style={{ minHeight: BUTTON_HEIGHT, minWidth: BUTTON_HEIGHT }}
      >
        <FileText size={24} />
        <span className="text-xs mt-1">PDF</span>
      </button>
      <button
        onClick={onWhatsAppClick}
        aria-label="Share via WhatsApp"
        className="flex flex-col items-center justify-center text-green-500 focus:outline-none"
        style={{ minHeight: BUTTON_HEIGHT, minWidth: BUTTON_HEIGHT }}
      >
        <Share2 size={24} />
        <span className="text-xs mt-1">WhatsApp</span>
      </button>
    </nav>
  )
}

// ---------------------------
// Dashboard Cards Component
function DashboardCards({
  netBalance,
  mySpending,
  partnerSpending
}) {
  return (
    <div className="grid grid-cols-3 gap-3 my-4 px-4" aria-label="Dashboard summary cards">
      <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
        <div className="text-sm font-semibold text-gray-700">Net Balance</div>
        <div
          className={`mt-2 text-lg font-bold ${
            netBalance >= 0 ? 'text-green-700' : 'text-red-700'
          }`}
        >
          {formatIndianCurrency(netBalance)}
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
        <div className="text-sm font-semibold text-gray-700">My Spending</div>
        <div className="mt-2 text-lg font-bold text-red-700">
          {formatIndianCurrency(mySpending)}
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
        <div className="text-sm font-semibold text-gray-700">Partner's Spending</div>
        <div className="mt-2 text-lg font-bold text-red-700">
          {formatIndianCurrency(partnerSpending)}
        </div>
      </div>
    </div>
  )
}

// ---------------------------
// Analytics PieChart Component
function AnalyticsChart({ transactions }) {
  // Aggregate expenses by category (OUT only)
  const categoryMap = {}
  transactions.forEach((tx) => {
    if (tx.type === 'OUT') {
      if (!categoryMap[tx.category]) categoryMap[tx.category] = 0
      categoryMap[tx.category] += tx.amount
    }
  })

  const data = Object.entries(categoryMap).map(([key, value]) => ({
    name: key,
    value
  }))

  return (
    <div className="flex justify-center my-6" aria-label="Expenses by category donut chart">
      {data.length === 0 ? (
        <p className="text-center text-gray-500">
          No expense data to display.
        </p>
      ) : (
        <RePieChart width={320} height={320}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={110}
            fill="#8884d8"
            dataKey="value"
            label={({ name, percent }) =>
              `${name}: ${(percent * 100).toFixed(0)}%`
            }
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip formatter={(value) => formatIndianCurrency(value)} />
          <Legend verticalAlign="bottom" height={36} />
        </RePieChart>
      )}
    </div>
  )
}

// ---------------------------
// Main App Component
export default function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editTransaction, setEditTransaction] = useState(null)
  const [view, setView] = useState('home') // 'home' | 'analytics'

  // Firebase Auth session tracking
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
    })
    return () => unsubscribe()
  }, [])

  // Firestore transactions subscribe
  useEffect(() => {
    if (!currentUser) {
      setTransactions([])
      setLoadingData(false)
      return
    }
    setLoadingData(true)
    const q = query(
      collection(db, 'transactions'),
      orderBy('createdAt', 'desc')
    )
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const txs = []
        snapshot.forEach((docSnapshot) => {
          txs.push({ id: docSnapshot.id, ...docSnapshot.data() })
        })
        setTransactions(txs)
        setLoadingData(false)
      },
      (error) => {
        console.error('Error fetching transactions:', error)
        setLoadingData(false)
      }
    )
    return () => unsubscribe()
  }, [currentUser])

  // Calculate dashboard stats
  const myEntries = transactions.filter((t) => t.userId === (currentUser && currentUser.uid))
  const partnerEntries = transactions.filter((t) => t.userId !== (currentUser && currentUser.uid))

  const myInTotal = myEntries
    .filter((t) => t.type === 'IN')
    .reduce((acc, t) => acc + t.amount, 0)
  const myOutTotal = myEntries
    .filter((t) => t.type === 'OUT')
    .reduce((acc, t) => acc + t.amount, 0)
  const partnerInTotal = partnerEntries
    .filter((t) => t.type === 'IN')
    .reduce((acc, t) => acc + t.amount, 0)
  const partnerOutTotal = partnerEntries
    .filter((t) => t.type === 'OUT')
    .reduce((acc, t) => acc + t.amount, 0)

  const netBalance = myInTotal - myOutTotal + partnerInTotal - partnerOutTotal

  // Handlers for edit/delete
  const handleEdit = (transaction) => {
    setEditTransaction(transaction)
    setShowModal(true)
  }
  const handleDelete = async (transaction) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      try {
        await deleteDoc(doc(db, 'transactions', transaction.id))
      } catch (err) {
        alert('Error deleting transaction: ' + err.message)
      }
    }
  }

  // Handlers for modal save/close
  const handleModalSave = () => {
    setShowModal(false)
    setEditTransaction(null)
  }
  const handleModalClose = () => {
    setShowModal(false)
    setEditTransaction(null)
  }

  // PDF Export
  const exportToPDF = () => {
    if (transactions.length === 0) {
      alert('No transactions to export.')
      return
    }
    const docpdf = new jsPDF()
    docpdf.text('CashBook Pro Transactions Report', 14, 20)
    const tableColumn = [
      'Date',
      'User',
      'Amount',
      'Type',
      'Category',
      'Remark'
    ]
    const tableRows = []

    transactions.forEach((tx) => {
      const txData = [
        tx.createdAt && tx.createdAt.seconds
          ? format(new Date(tx.createdAt.seconds * 1000), 'dd MMM yyyy hh:mm a')
          : '',
        tx.userName || tx.userEmail || 'Unknown',
        formatIndianCurrency(tx.amount),
        tx.type,
        tx.category,
        tx.remark || ''
      ]
      tableRows.push(txData)
    })

    docpdf.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [40, 116, 240] }
    })
    docpdf.save('CashBookPro_Transactions_Report.pdf')
  }

  // WhatsApp Share - share summary as text
  const shareViaWhatsApp = () => {
    if (!currentUser) {
      alert('Please login to share.')
      return
    }
    const summary = `CashBook Pro Summary
Net Balance: ${formatIndianCurrency(netBalance)}
My Spending: ${formatIndianCurrency(myOutTotal)}
Partner Spending: ${formatIndianCurrency(partnerOutTotal)}
Total Transactions: ${transactions.length}

View your transactions in the app!`

    const encodedText = encodeURIComponent(summary)
    const url = `https://wa.me/?text=${encodedText}`
    window.open(url, '_blank')
  }

  // Logout function
  const handleLogout = async () => {
    const confirmed = window.confirm('Logout from CashBook Pro?')
    if (confirmed) {
      await signOut(auth)
    }
  }

  // Scrollbar styling: hide scrollbar for transaction list (inline styles)
  const scrollbarStyle = {
    scrollbarWidth: 'none' /* Firefox */,
    msOverflowStyle: 'none' /* IE 10+ */,
  }
  // Chrome, Edge, Safari scrollbar hide via global css not possible here inline.
  // So we will add className and user can override css in stylesheet if necessary.

  // If not logged in show Auth component
  if (!currentUser) return <Auth onUserLoggedIn={setCurrentUser} />

  return (
    <div className="min-h-screen bg-gray-100 pb-24 flex flex-col" style={{ WebkitTapHighlightColor: 'transparent' }}>
      <header className="bg-indigo-700 text-white p-4 flex items-center justify-between">
        <h1 className="text-xl font-bold select-none">CashBook Pro</h1>
        <button
          onClick={handleLogout}
          aria-label="Logout"
          className="flex items-center space-x-1 hover:bg-indigo-800 rounded p-2 focus:outline-none"
          style={{ minHeight: BUTTON_HEIGHT }}
        >
          <LogOut size={20} />
          <span className="hidden md:inline">Logout</span>
        </button>
      </header>

      <main className="flex-grow overflow-auto px-3" style={scrollbarStyle}>
        {loadingData ? (
          <div className="mt-10 text-center text-gray-500">Loading transactions...</div>
        ) : (
          <>
            {view === 'home' && (
              <>
                <DashboardCards
                  netBalance={netBalance}
                  mySpending={myOutTotal}
                  partnerSpending={partnerOutTotal}
                />
                <section aria-label="Transaction list" className="max-w-4xl mx-auto">
                  {transactions.length === 0 ? (
                    <p className="text-center text-gray-600">
                      No transactions found. Add your first entry!
                    </p>
                  ) : (
                    transactions.map((tx) => (
                      <TransactionRow
                        key={tx.id}
                        transaction={tx}
                        currentUser={currentUser}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))
                  )}
                </section>
              </>
            )}
            {view === 'analytics' && (
              <AnalyticsChart transactions={transactions} />
            )}
          </>
        )}
      </main>

      <FloatingDock
        onHomeClick={() => setView('home')}
        onAnalyticsClick={() => setView('analytics')}
        onAddClick={() => setShowModal(true)}
        onPDFClick={exportToPDF}
        onWhatsAppClick={shareViaWhatsApp}
        activeView={view}
      />

      <TransactionModal
        currentUser={currentUser}
        categories={categories}
        show={showModal}
        onClose={handleModalClose}
        onSave={handleModalSave}
        editTransaction={editTransaction}
      />

      {/* Inline styles for hiding scrollbar on WebKit browsers */}
      <style jsx>{`
        main::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}
