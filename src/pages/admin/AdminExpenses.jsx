import { useState, useEffect, useMemo } from 'react'
import {
  Receipt, Plus, Search, CheckCircle, Clock,
  TrendingDown, Trash2, Eye, X,
  FileSpreadsheet, FileText,
  Building2, Edit3, Calendar,
  Package, ArrowRight
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function addDaysToDate(dateStr, days) {
  if (!days) return dateStr || ''
  const base = dateStr ? new Date(dateStr) : new Date()
  base.setDate(base.getDate() + parseInt(days, 10))
  return base.toISOString().split('T')[0]
}

// Categorías de gastos habituales en salón de peluquería y estética
const EXPENSE_CATEGORIES = [
  'Productos y Cosmética (Inventario)',
  'Alquiler del Salón',
  'Suministros (Luz, Agua, Gas, Internet)',
  'Nóminas y Seguridad Social',
  'Gestoría, Asesoría y Software',
  'Herramientas y Mobiliario (Tijeras, Secadores...)',
  'Marketing y Publicidad',
  'Mantenimiento y Reformas',
  'Otros Gastos Generales'
]

const PAYMENT_METHODS = [
  { id: 'transfer', label: 'Transferencia Bancaria' },
  { id: 'direct_debit', label: 'Domiciliación Bancaria (Recibo)' },
  { id: 'promissory_note', label: 'Pagaré / Efecto Comercial' },
  { id: 'card', label: 'Tarjeta de Empresa' },
  { id: 'cash', label: 'Efectivo (Caja)' }
]

export default function AdminExpenses() {
  const [invoices, setInvoices] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [stockMovements, setStockMovements] = useState([])
  const [selectedAlbaranNumbers, setSelectedAlbaranNumbers] = useState([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'paid' | 'pending'
  const [periodFilter, setPeriodFilter] = useState('all') // 'all' | 'current_quarter' | 'current_month' | 'all_year'
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString())

  // Modal Nueva / Editar Factura
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingInvoiceId, setEditingInvoiceId] = useState(null)
  const [selectedInvoiceDetails, setSelectedInvoiceDetails] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Estado del formulario
  const [form, setForm] = useState({
    invoice_number: '',
    supplier_name: '',
    category: 'Productos y Cosmética (Inventario)',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    base_amount: '',
    tax_rate: 21,
    irpf_rate: 0,
    payment_method: 'transfer',
    payment_status: 'paid',
    notes: '',
    reflect_in_cash: false
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      // 1. Obtener proveedores de Supabase
      const { data: suppData } = await supabase.from('suppliers').select('*').order('name')
      if (suppData) setSuppliers(suppData)

      // 2. Intentar obtener facturas de Supabase
      const { data: invData, error: invError } = await supabase
        .from('supplier_invoices')
        .select('*')
        .order('invoice_date', { ascending: false })

      if (!invError && invData) {
        const local = localStorage.getItem('ohana_supplier_invoices')
        let localInvs = []
        try { localInvs = local ? JSON.parse(local) : [] } catch {}
        const combined = [...invData]
        localInvs.forEach(l => {
          if (!combined.some(c => c.id === l.id)) {
            combined.unshift(l)
          }
        })
        setInvoices(combined)
      } else {
        // Fallback a localStorage si la tabla no existe aún en Postgres
        const local = localStorage.getItem('ohana_supplier_invoices')
        if (local) {
          try {
            setInvoices(JSON.parse(local))
          } catch {
            setInvoices([])
          }
        } else {
          setInvoices([])
        }
      }

      // 3. Obtener albaranes de entrada de almacén con sus productos y costes
      try {
        const { data: movData } = await supabase
          .from('stock_movements')
          .select(`
            id,
            albaran_number,
            reason,
            created_at,
            type,
            stock_movement_items (
              quantity,
              product:products (id, name, supplier, cost_price)
            )
          `)
          .eq('type', 'in')
          .not('albaran_number', 'is', null)
          .order('created_at', { ascending: false })

        if (movData) {
          setStockMovements(movData)
        }
      } catch (movErr) {
        console.warn('Error cargando movimientos de stock:', movErr)
      }
    } catch (err) {
      console.warn('Error cargando facturas:', err)
      const local = localStorage.getItem('ohana_supplier_invoices')
      if (local) {
        try { setInvoices(JSON.parse(local)) } catch {}
      }
    } finally {
      setLoading(false)
    }
  }

  // Guardar en Storage / Supabase
  async function saveInvoiceData(newInvoice, isEdit = false) {
    try {
      if (isEdit) {
        const { error } = await supabase
          .from('supplier_invoices')
          .update(newInvoice)
          .eq('id', newInvoice.id)
        if (error && error.code === 'PGRST205') throw error
      } else {
        const { error } = await supabase
          .from('supplier_invoices')
          .insert([newInvoice])
        if (error && error.code === 'PGRST205') throw error
      }
    } catch {
      // Fallback local
      const current = [...invoices]
      let updated
      if (isEdit) {
        updated = current.map(inv => inv.id === newInvoice.id ? newInvoice : inv)
      } else {
        updated = [newInvoice, ...current]
      }
      localStorage.setItem('ohana_supplier_invoices', JSON.stringify(updated))
    }
  }

  // Cálculos automáticos de IVA y Total
  const calculatedAmounts = useMemo(() => {
    const base = parseFloat(form.base_amount) || 0
    const taxRate = parseFloat(form.tax_rate) || 0
    const irpfRate = parseFloat(form.irpf_rate) || 0

    const taxAmount = (base * taxRate) / 100
    const irpfAmount = (base * irpfRate) / 100
    const totalAmount = base + taxAmount - irpfAmount

    return {
      base: base.toFixed(2),
      tax: taxAmount.toFixed(2),
      irpf: irpfAmount.toFixed(2),
      total: totalAmount.toFixed(2)
    }
  }, [form.base_amount, form.tax_rate, form.irpf_rate])

  // Filtrado de Facturas
  const filteredInvoices = useMemo(() => {
    const now = new Date()
    const currentYear = parseInt(selectedYear) || now.getFullYear()
    const currentMonth = now.getMonth() // 0-11
    const currentQuarter = Math.floor(currentMonth / 3) + 1 // 1, 2, 3, 4

    return invoices.filter(inv => {
      // Filtro texto (número de factura, proveedor, notas)
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch = !q ||
        (inv.invoice_number && inv.invoice_number.toLowerCase().includes(q)) ||
        (inv.supplier_name && inv.supplier_name.toLowerCase().includes(q)) ||
        (inv.notes && inv.notes.toLowerCase().includes(q))

      // Filtro Categoría
      const matchesCategory = categoryFilter === 'all' || inv.category === categoryFilter

      // Filtro Proveedor
      const matchesSupplier = supplierFilter === 'all' || inv.supplier_name === supplierFilter

      // Filtro Estado (pagado / pendiente)
      const matchesStatus = statusFilter === 'all' || inv.payment_status === statusFilter

      // Filtro Período
      const dateParts = (inv.invoice_date || '').split('T')[0].split('-')
      const invYear = dateParts.length >= 1 ? (parseInt(dateParts[0], 10) || now.getFullYear()) : now.getFullYear()
      const invMonth = dateParts.length >= 2 ? ((parseInt(dateParts[1], 10) || 1) - 1) : 0
      const invQuarter = Math.floor(invMonth / 3) + 1

      let matchesPeriod = true
      if (periodFilter === 'current_month') {
        matchesPeriod = invYear === now.getFullYear() && invMonth === currentMonth
      } else if (periodFilter === 'current_quarter') {
        matchesPeriod = invYear === now.getFullYear() && invQuarter === currentQuarter
      } else if (periodFilter === 'q1') {
        matchesPeriod = invYear === currentYear && invQuarter === 1
      } else if (periodFilter === 'q2') {
        matchesPeriod = invYear === currentYear && invQuarter === 2
      } else if (periodFilter === 'q3') {
        matchesPeriod = invYear === currentYear && invQuarter === 3
      } else if (periodFilter === 'q4') {
        matchesPeriod = invYear === currentYear && invQuarter === 4
      } else if (periodFilter === 'all_year') {
        matchesPeriod = invYear === currentYear
      }

      return matchesSearch && matchesCategory && matchesSupplier && matchesStatus && matchesPeriod
    })
  }, [invoices, searchQuery, categoryFilter, supplierFilter, statusFilter, periodFilter, selectedYear])

  // Métricas acumuladas del período filtrado
  const metrics = useMemo(() => {
    let totalBase = 0
    let totalTax = 0
    let totalIrpf = 0
    let totalAmount = 0
    let pendingAmount = 0
    let paidAmount = 0

    filteredInvoices.forEach(inv => {
      const base = parseFloat(inv.base_amount) || 0
      const tax = parseFloat(inv.tax_amount) || 0
      const irpf = parseFloat(inv.irpf_amount) || 0
      const total = parseFloat(inv.total_amount) || 0

      totalBase += base
      totalTax += tax
      totalIrpf += irpf
      totalAmount += total

      if (inv.payment_status === 'pending') {
        pendingAmount += total
      } else {
        paidAmount += total
      }
    })

    return {
      totalBase,
      totalTax,
      totalIrpf,
      totalAmount,
      pendingAmount,
      paidAmount,
      count: filteredInvoices.length
    }
  }, [filteredInvoices])

  // Albaranes de entrada no facturados todavía
  const unbilledAlbaranes = useMemo(() => {
    // Recopilar todos los números de albarán ya facturados en supplier_invoices
    const billedAlbaranNumbers = new Set()
    invoices.forEach(inv => {
      if (inv.albaran_number) {
        inv.albaran_number
          .split(',')
          .map(s => s.trim().toUpperCase())
          .filter(Boolean)
          .forEach(num => billedAlbaranNumbers.add(num))
      }
    })

    return stockMovements
      .filter(m => m.albaran_number && !billedAlbaranNumbers.has(m.albaran_number.trim().toUpperCase()))
      .map(m => {
        // Extraer proveedor del motivo "Recepción Pedido ... (Proveedor)" o del producto
        const suppMatch = m.reason?.match(/\(([^)]+)\)$/)
        const supplierName = suppMatch
          ? suppMatch[1].trim()
          : (m.stock_movement_items?.[0]?.product?.supplier || 'Proveedor General')

        // Sumar base estimada
        const totalBase = (m.stock_movement_items || []).reduce((acc, item) => {
          const cost = parseFloat(item.product?.cost_price) || 0
          return acc + (cost * (item.quantity || 0))
        }, 0)

        const totalUnits = (m.stock_movement_items || []).reduce((acc, item) => acc + (item.quantity || 0), 0)

        return {
          id: m.id,
          albaran_number: m.albaran_number.trim(),
          supplier: supplierName,
          date: m.created_at ? m.created_at.split('T')[0] : '',
          totalBase: Math.round(totalBase * 100) / 100,
          totalUnits,
          itemsCount: m.stock_movement_items?.length || 0,
          items: m.stock_movement_items || [],
          reason: m.reason
        }
      })
  }, [stockMovements, invoices])

  // Agrupados por proveedor para los botones rápidos y resumen
  const unbilledBySupplier = useMemo(() => {
    const map = new Map()
    unbilledAlbaranes.forEach(alb => {
      const key = alb.supplier || 'Proveedor General'
      if (!map.has(key)) {
        map.set(key, {
          supplier: key,
          albaranes: [],
          totalBase: 0,
          totalUnits: 0
        })
      }
      const group = map.get(key)
      group.albaranes.push(alb)
      group.totalBase += alb.totalBase
      group.totalUnits += alb.totalUnits
    })
    return Array.from(map.values())
  }, [unbilledAlbaranes])

  // Albaranes pendientes filtrados para el proveedor actualmente escrito en el formulario
  const supplierPendingAlbaranes = useMemo(() => {
    if (!form.supplier_name.trim()) return unbilledAlbaranes
    const search = form.supplier_name.toLowerCase().trim()
    const matching = unbilledAlbaranes.filter(alb => {
      const albSupp = (alb.supplier || '').toLowerCase()
      return albSupp.includes(search) || search.includes(albSupp)
    })
    return matching.length > 0 ? matching : unbilledAlbaranes
  }, [unbilledAlbaranes, form.supplier_name])

  // Selección de albaranes en el modal
  function handleToggleAlbaran(alb) {
    const isSelected = selectedAlbaranNumbers.includes(alb.albaran_number)
    const nextSelected = isSelected
      ? selectedAlbaranNumbers.filter(n => n !== alb.albaran_number)
      : [...selectedAlbaranNumbers, alb.albaran_number]

    setSelectedAlbaranNumbers(nextSelected)

    // Si el proveedor está vacío o es genérico, asignar el de este albarán
    const nextSupplier = form.supplier_name.trim() ? form.supplier_name : alb.supplier

    // Calcular nueva base total de los seleccionados
    const selectedAlbs = unbilledAlbaranes.filter(a => nextSelected.includes(a.albaran_number))
    const newBase = selectedAlbs.reduce((sum, a) => sum + a.totalBase, 0)

    setForm(prev => ({
      ...prev,
      supplier_name: nextSupplier,
      albaran_number: nextSelected.join(', '),
      base_amount: newBase > 0 ? newBase.toFixed(2) : (nextSelected.length === 0 ? '' : prev.base_amount),
      notes: nextSelected.length > 1
        ? `Factura recapitulativa que incluye albaranes: ${nextSelected.join(', ')}`
        : prev.notes
    }))
  }

  function handleSelectAllSupplierAlbaranes() {
    const numbers = supplierPendingAlbaranes.map(a => a.albaran_number)
    setSelectedAlbaranNumbers(numbers)
    const totalBase = supplierPendingAlbaranes.reduce((sum, a) => sum + a.totalBase, 0)
    const nextSupplier = form.supplier_name.trim() ? form.supplier_name : (supplierPendingAlbaranes[0]?.supplier || '')

    setForm(prev => ({
      ...prev,
      supplier_name: nextSupplier,
      albaran_number: numbers.join(', '),
      base_amount: totalBase.toFixed(2),
      notes: numbers.length > 1
        ? `Factura recapitulativa que incluye albaranes: ${numbers.join(', ')}`
        : prev.notes
    }))
  }

  function handleDeselectAllAlbaranes() {
    setSelectedAlbaranNumbers([])
    setForm(prev => ({
      ...prev,
      albaran_number: '',
      base_amount: ''
    }))
  }

  // Abrir modal nuevo
  function openNewInvoiceModal(initialSupplier = '', initialAlbaranNumbers = []) {
    setEditingInvoiceId(null)
    const initialList = Array.isArray(initialAlbaranNumbers) ? initialAlbaranNumbers : []
    setSelectedAlbaranNumbers(initialList)

    let calculatedBase = ''
    if (initialList.length > 0) {
      const selectedAlbs = unbilledAlbaranes.filter(a => initialList.includes(a.albaran_number))
      const sum = selectedAlbs.reduce((acc, a) => acc + a.totalBase, 0)
      if (sum > 0) calculatedBase = sum.toFixed(2)
    }

    setForm({
      invoice_number: '',
      supplier_name: typeof initialSupplier === 'string' ? initialSupplier : '',
      category: 'Productos y Cosmética (Inventario)',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: '',
      albaran_number: initialList.join(', '),
      base_amount: calculatedBase,
      tax_rate: 21,
      irpf_rate: 0,
      payment_method: 'transfer',
      payment_status: 'paid',
      notes: initialList.length > 1
        ? `Factura mensual recapitulativa que incluye: ${initialList.join(', ')}`
        : '',
      reflect_in_cash: false
    })
    setIsModalOpen(true)
  }

  // Abrir modal editar
  function openEditInvoiceModal(inv) {
    setEditingInvoiceId(inv.id)
    const existingAlbs = inv.albaran_number
      ? inv.albaran_number.split(',').map(s => s.trim()).filter(Boolean)
      : []
    setSelectedAlbaranNumbers(existingAlbs)
    setForm({
      invoice_number: inv.invoice_number || '',
      supplier_name: inv.supplier_name || '',
      category: inv.category || 'Productos y Cosmética (Inventario)',
      invoice_date: inv.invoice_date || new Date().toISOString().split('T')[0],
      due_date: inv.due_date || '',
      albaran_number: inv.albaran_number || '',
      base_amount: inv.base_amount?.toString() || '',
      tax_rate: inv.tax_rate ?? 21,
      irpf_rate: inv.irpf_rate ?? 0,
      payment_method: inv.payment_method || 'transfer',
      payment_status: inv.payment_status || 'paid',
      notes: inv.notes || '',
      reflect_in_cash: false
    })
    setIsModalOpen(true)
  }

  // Guardar factura
  async function handleSubmitInvoice(e) {
    e.preventDefault()
    if (!form.invoice_number.trim()) return alert('Introduce el número de factura del proveedor')
    if (!form.supplier_name.trim()) return alert('Introduce el nombre del proveedor o acreedor')
    if (!form.base_amount || parseFloat(form.base_amount) <= 0) return alert('Introduce una base imponible válida')

    setIsSubmitting(true)
    try {
      const base = parseFloat(calculatedAmounts.base)
      const tax = parseFloat(calculatedAmounts.tax)
      const irpf = parseFloat(calculatedAmounts.irpf)
      const total = parseFloat(calculatedAmounts.total)

      const invoiceData = {
        id: editingInvoiceId || crypto.randomUUID(),
        invoice_number: form.invoice_number.trim(),
        supplier_name: form.supplier_name.trim(),
        category: form.category,
        invoice_date: form.invoice_date,
        due_date: form.due_date || null,
        albaran_number: form.albaran_number?.trim() || null,
        base_amount: base,
        tax_rate: parseFloat(form.tax_rate),
        tax_amount: tax,
        irpf_rate: parseFloat(form.irpf_rate),
        irpf_amount: irpf,
        total_amount: total,
        payment_method: form.payment_method,
        payment_status: form.payment_status,
        notes: form.notes.trim() || null,
        created_at: editingInvoiceId ? undefined : new Date().toISOString()
      }

      await saveInvoiceData(invoiceData, !!editingInvoiceId)

      // Si se paga en efectivo y se marcó reflejar en caja diaria
      if (form.payment_method === 'cash' && form.reflect_in_cash && !editingInvoiceId) {
        try {
          await supabase.from('cash_movements').insert([{
            type: 'out',
            amount: total,
            reason: `Gasto Factura: ${form.supplier_name} (#${form.invoice_number})`,
            payment_method: 'cash'
          }])
        } catch (cErr) {
          console.warn('No se pudo insertar en cash_movements:', cErr)
        }
      }

      await fetchData()
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error guardando factura:', err)
      alert('Error al guardar la factura: ' + (err.message || 'Error desconocido'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Cambiar estado Pagada / Pendiente con 1 clic
  async function handleToggleStatus(inv) {
    const nextStatus = inv.payment_status === 'paid' ? 'pending' : 'paid'
    const updated = { ...inv, payment_status: nextStatus }

    // Si pasa a pagada y es en efectivo, preguntar si reflejar en la caja de hoy
    if (nextStatus === 'paid' && inv.payment_method === 'cash') {
      const confirmCash = window.confirm(
        `Esta factura está marcada como pago en EFECTIVO (${(inv.total_amount || 0).toFixed(2)}€).\n\n¿Deseas registrar automáticamente una salida de dinero en la Caja de hoy?`
      )
      if (confirmCash) {
        try {
          await supabase.from('cash_movements').insert([{
            type: 'out',
            amount: inv.total_amount,
            reason: `Gasto Factura: ${inv.supplier_name} (#${inv.invoice_number})`,
            payment_method: 'cash'
          }])
        } catch (cErr) {
          console.warn('No se pudo insertar en cash_movements:', cErr)
        }
      }
    }

    try {
      await saveInvoiceData(updated, true)
      await fetchData()
    } catch (err) {
      console.error(err)
    }
  }

  // Cambiar forma de pago rápidamente desde el desplegable de la tabla
  async function handleQuickChangePaymentMethod(inv, newMethod) {
    const updated = { ...inv, payment_method: newMethod }
    try {
      await saveInvoiceData(updated, true)
      setInvoices(prev => prev.map(i => i.id === inv.id ? updated : i))
    } catch (err) {
      console.error('Error actualizando forma de pago:', err)
    }
  }

  // Eliminar factura
  async function handleDeleteInvoice(inv) {
    if (!window.confirm(`¿Seguro que deseas eliminar la factura ${inv.invoice_number} de ${inv.supplier_name}?`)) return
    try {
      const { error } = await supabase.from('supplier_invoices').delete().eq('id', inv.id)
      if (error && error.code === 'PGRST205') throw error
    } catch {
      const updated = invoices.filter(i => i.id !== inv.id)
      localStorage.setItem('ohana_supplier_invoices', JSON.stringify(updated))
    }
    await fetchData()
  }

  // --- EXPORTACIÓN PARA GESTORÍA (EXCEL / CSV) ---
  function exportToCSV() {
    if (filteredInvoices.length === 0) return alert('No hay facturas para exportar con los filtros actuales')

    const headers = [
      'Nº Factura',
      'Fecha Emisión',
      'Proveedor / Acreedor',
      'Categoría de Gasto',
      'Base Imponible (€)',
      '% IVA',
      'Cuota IVA (€)',
      '% IRPF',
      'Retención IRPF (€)',
      'Total Factura (€)',
      'Forma de Pago',
      'Estado',
      'Observaciones'
    ]

    const rows = filteredInvoices.map(inv => [
      `"${inv.invoice_number || ''}"`,
      `"${inv.invoice_date || ''}"`,
      `"${(inv.supplier_name || '').replace(/"/g, '""')}"`,
      `"${inv.category || ''}"`,
      (inv.base_amount || 0).toFixed(2).replace('.', ','),
      `${inv.tax_rate || 21}%`,
      (inv.tax_amount || 0).toFixed(2).replace('.', ','),
      `${inv.irpf_rate || 0}%`,
      (inv.irpf_amount || 0).toFixed(2).replace('.', ','),
      (inv.total_amount || 0).toFixed(2).replace('.', ','),
      `"${PAYMENT_METHODS.find(m => m.id === inv.payment_method)?.label || inv.payment_method || ''}"`,
      inv.payment_status === 'paid' ? 'Pagada' : 'Pendiente',
      `"${(inv.notes || '').replace(/"/g, '""')}"`
    ])

    // Añadir fila de totales
    rows.push([
      '"TOTALES"',
      '""',
      '""',
      '""',
      metrics.totalBase.toFixed(2).replace('.', ','),
      '""',
      metrics.totalTax.toFixed(2).replace('.', ','),
      '""',
      metrics.totalIrpf.toFixed(2).replace('.', ','),
      metrics.totalAmount.toFixed(2).replace('.', ','),
      '""',
      '""',
      '""'
    ])

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Facturas_Gastos_Ohana_${periodFilter}_${selectedYear}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // --- EXPORTACIÓN PARA GESTORÍA (PDF FORMAL) ---
  function exportToPDF() {
    if (filteredInvoices.length === 0) return alert('No hay facturas para exportar con los filtros actuales')

    const doc = new jsPDF()

    // Encabezado
    doc.setFillColor(15, 23, 42) // Slate 900
    doc.rect(0, 0, 210, 32, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('OHANA - LIBRO DE FACTURAS RECIBIDAS Y GASTOS', 14, 15)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Período: ${periodFilter.toUpperCase()} ${selectedYear} | Generado el ${new Date().toLocaleDateString('es-ES')}`, 14, 24)

    // Resumen Fiscal
    doc.setTextColor(30, 41, 59)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('RESUMEN DE BASES E IMPUESTOS SOPORTADOS (MODELO 303 / 130)', 14, 42)

    autoTable(doc, {
      startY: 46,
      head: [['Concepto Fiscal', 'Importe Acumulado']],
      body: [
        ['Total Base Imponible Deducible', `${metrics.totalBase.toFixed(2)} €`],
        ['Total Cuota IVA Soportado (21% / 10% / 4%)', `${metrics.totalTax.toFixed(2)} €`],
        ['Total Retenciones IRPF Practicadas', `${metrics.totalIrpf.toFixed(2)} €`],
        ['TOTAL GASTOS Y COMPRAS DEL PERÍODO', `${metrics.totalAmount.toFixed(2)} €`],
        ['Facturas Pagadas', `${metrics.paidAmount.toFixed(2)} €`],
        ['Facturas Pendientes de Pago', `${metrics.pendingAmount.toFixed(2)} €`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], fontStyle: 'bold' },
      styles: { fontSize: 8 }
    })

    // Tabla de facturas
    const startTableY = (doc).lastAutoTable.finalY + 10
    doc.text('DESGLOSE DETALLADO DE FACTURAS', 14, startTableY)

    const tableBody = filteredInvoices.map(inv => [
      inv.invoice_number,
      inv.invoice_date,
      inv.supplier_name,
      inv.category.substring(0, 25),
      `${(inv.base_amount || 0).toFixed(2)} €`,
      `${inv.tax_rate}% (${(inv.tax_amount || 0).toFixed(2)} €)`,
      `${(inv.total_amount || 0).toFixed(2)} €`,
      inv.payment_status === 'paid' ? 'Pagada' : 'Pendiente'
    ])

    autoTable(doc, {
      startY: startTableY + 4,
      head: [['Nº Factura', 'Fecha', 'Proveedor', 'Categoría', 'Base', 'IVA', 'Total', 'Estado']],
      body: tableBody,
      foot: [['TOTALES', '', '', '', `${metrics.totalBase.toFixed(2)} €`, `${metrics.totalTax.toFixed(2)} €`, `${metrics.totalAmount.toFixed(2)} €`, '']],
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 7 }
    })

    doc.save(`Libro_Facturas_Ohana_${periodFilter}_${selectedYear}.pdf`)
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* CABECERA PRINCIPAL */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2.5">
            <Receipt className="w-7 h-7 text-primary" /> Facturas y Gastos de Proveedores
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Control de facturas recibidas, compras de stock, gastos generales y modelos tributarios para tu gestoría.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
          <button
            onClick={exportToPDF}
            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-red-600" /> Exportar PDF
          </button>

          <button
            onClick={exportToCSV}
            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exportar Excel
          </button>

          <button
            onClick={openNewInvoiceModal}
            className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Registrar Factura / Gasto
          </button>
        </div>
      </div>

      {/* BANNER DE ALBARANES PENDIENTES DE FACTURAR */}
      {unbilledAlbaranes.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200/90 rounded-2xl p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  Albaranes de entrega pendientes de facturar ({unbilledAlbaranes.length})
                  <span className="bg-amber-200 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase">
                    Por Facturar
                  </span>
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Mercancía recepcionada en almacén con albarán pendiente de factura mensual agrupada.
                </p>
              </div>
            </div>

            <div className="text-right flex items-center gap-2 self-start md:self-auto bg-white/70 px-3 py-1.5 rounded-xl border border-amber-200">
              <span className="text-xs text-gray-600 font-medium">Base pendiente acumulada:</span>
              <span className="text-sm font-black text-amber-900">
                {unbilledAlbaranes.reduce((s, a) => s + a.totalBase, 0).toFixed(2)} €
              </span>
            </div>
          </div>

          {/* Tarjetas / botones por proveedor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-3 border-t border-amber-200/70">
            {unbilledBySupplier.map(group => (
              <div
                key={group.supplier}
                className="bg-white/95 border border-amber-200/90 p-3 rounded-xl flex items-center justify-between gap-2 shadow-2xs hover:shadow-xs transition"
              >
                <div className="min-w-0">
                  <span className="font-bold text-xs text-gray-900 block truncate">{group.supplier}</span>
                  <span className="text-[11px] text-gray-500">
                    {group.albaranes.length} {group.albaranes.length === 1 ? 'albarán' : 'albaranes'} • <strong className="text-gray-800">{group.totalBase.toFixed(2)} €</strong> base
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => openNewInvoiceModal(group.supplier, group.albaranes.map(a => a.albaran_number))}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg transition shadow-2xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  title={`Crear factura mensual agrupada para ${group.supplier}`}
                >
                  Facturar <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TARJETAS DE RESUMEN FISCAL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Gastos */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Gastos (Período)</span>
            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-gray-900 tracking-tight">
            {metrics.totalAmount.toFixed(2)}€
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {metrics.count} {metrics.count === 1 ? 'factura registrada' : 'facturas registradas'}
          </p>
        </div>

        {/* Card 2: Base Imponible */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Base Imponible</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-gray-900 tracking-tight">
            {metrics.totalBase.toFixed(2)}€
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Coste neto deducible para IRPF
          </p>
        </div>

        {/* Card 3: IVA Soportado */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">IVA Soportado</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-600 tracking-tight">
            {metrics.totalTax.toFixed(2)}€
          </div>
          <p className="text-xs text-emerald-700 font-semibold mt-2">
            A compensar en el Modelo 303 trimestral
          </p>
        </div>

        {/* Card 4: Pendiente vs Pagado */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Estado de Pagos</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">Pagado:</span>
              <span className="font-bold text-gray-900">{metrics.paidAmount.toFixed(2)}€</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">Pendiente:</span>
              <span className="font-black text-amber-600">{metrics.pendingAmount.toFixed(2)}€</span>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all"
              style={{ width: `${metrics.totalAmount > 0 ? (metrics.paidAmount / metrics.totalAmount) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* Buscador */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por Nº factura, proveedor o concepto..."
              className="w-full border border-gray-200 pl-10 pr-3.5 py-2 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none"
            />
          </div>

          {/* Filtro Período */}
          <div>
            <select
              value={periodFilter}
              onChange={e => setPeriodFilter(e.target.value)}
              className="w-full border border-gray-200 p-2 rounded-xl text-xs bg-white font-medium"
            >
              <option value="all">Todo el Histórico</option>
              <option value="current_month">Mes Actual</option>
              <option value="current_quarter">Trimestre Actual</option>
              <option value="q1">1er Trimestre (Ene - Mar)</option>
              <option value="q2">2º Trimestre (Abr - Jun)</option>
              <option value="q3">3er Trimestre (Jul - Sep)</option>
              <option value="q4">4º Trimestre (Oct - Dic)</option>
              <option value="all_year">Todo el Año Seleccionado</option>
            </select>
          </div>

          {/* Filtro Categoría */}
          <div>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full border border-gray-200 p-2 rounded-xl text-xs bg-white font-medium"
            >
              <option value="all">Todas las Categorías</option>
              {EXPENSE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Filtro Proveedor */}
          <div>
            <select
              value={supplierFilter}
              onChange={e => setSupplierFilter(e.target.value)}
              className="w-full border border-gray-200 p-2 rounded-xl text-xs bg-white font-medium"
            >
              <option value="all">Todos los Proveedores</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Selector de Año */}
          {(periodFilter === 'all_year' || periodFilter.startsWith('q')) && (
            <div>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="w-full border border-gray-200 p-2 rounded-xl text-xs bg-white font-medium"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y.toString()}>{y}</option>
                ))}
              </select>
            </div>
          )}

          {/* Filtro Estado */}
          <div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full border border-gray-200 p-2 rounded-xl text-xs bg-white font-medium"
            >
              <option value="all">Todos los Estados</option>
              <option value="paid">Solo Pagadas</option>
              <option value="pending">Solo Pendientes</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL DE FACTURAS */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-gray-500">Cargando libro de facturas...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-16 text-center text-gray-500">
            <Receipt className="w-12 h-12 mx-auto text-gray-300 stroke-1 mb-2" />
            <p className="font-bold text-gray-800">No se encontraron facturas con los filtros seleccionados.</p>
            <p className="text-xs text-gray-400 mt-1">Registra tu primera factura o albarán con el botón superior.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-50/70 border-b border-gray-100 font-bold text-gray-600">
                <tr>
                  <th className="p-4">Nº Factura</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Proveedor / Acreedor</th>
                  <th className="p-4">Categoría</th>
                  <th className="p-4">Forma de Pago</th>
                  <th className="p-4 text-right">Base Imponible</th>
                  <th className="p-4 text-right">IVA</th>
                  <th className="p-4 text-right">Total Factura</th>
                  <th className="p-4 text-center">Estado</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredInvoices.map(inv => {
                  const isPaid = inv.payment_status === 'paid'
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 font-bold text-gray-900 whitespace-nowrap">
                        {inv.invoice_number}
                        {inv.albaran_number && (
                          <span className="block text-[10px] text-gray-400 font-normal">
                            Alb: {inv.albaran_number}
                          </span>
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap text-gray-600">
                        <div className="font-semibold text-gray-900">{inv.invoice_date}</div>
                        {inv.due_date && (
                          <div className="mt-1">
                            {(() => {
                              const todayStr = new Date().toISOString().split('T')[0]
                              const isOverdue = !isPaid && inv.due_date < todayStr
                              const isSoon = !isPaid && !isOverdue && inv.due_date <= addDaysToDate(todayStr, 7)

                              return (
                                <span className={cn(
                                  "text-[10px] font-bold px-1.5 py-0.5 rounded-md inline-flex items-center gap-1",
                                  isPaid ? "text-gray-400 bg-gray-100" :
                                  isOverdue ? "text-red-700 bg-red-100 font-extrabold" :
                                  isSoon ? "text-amber-800 bg-amber-100 font-extrabold" :
                                  "text-gray-600 bg-gray-100"
                                )}>
                                  <Clock className="w-2.5 h-2.5" /> Vence: {inv.due_date}
                                  {isOverdue && " (Vencida)"}
                                  {isSoon && " (Pronto)"}
                                </span>
                              )
                            })()}
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-bold text-gray-900 whitespace-nowrap">
                        {inv.supplier_name}
                      </td>
                      <td className="p-4 text-gray-600 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700 font-medium text-[11px]">
                          {inv.category}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <select
                          value={inv.payment_method || 'transfer'}
                          onChange={(e) => handleQuickChangePaymentMethod(inv, e.target.value)}
                          className="border border-gray-200 rounded-lg p-1.5 text-xs bg-white text-gray-800 font-semibold focus:ring-2 focus:ring-primary/20 focus:outline-none cursor-pointer"
                        >
                          {PAYMENT_METHODS.map(m => (
                            <option key={m.id} value={m.id}>{m.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4 text-right font-medium text-gray-700 whitespace-nowrap">
                        {(inv.base_amount || 0).toFixed(2)}€
                      </td>
                      <td className="p-4 text-right text-emerald-700 font-medium whitespace-nowrap">
                        {(inv.tax_amount || 0).toFixed(2)}€ <span className="text-[10px] text-gray-400">({inv.tax_rate}%)</span>
                      </td>
                      <td className="p-4 text-right font-black text-gray-900 text-sm whitespace-nowrap">
                        {(inv.total_amount || 0).toFixed(2)}€
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(inv)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition flex items-center gap-1 mx-auto ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          }`}
                          title="Haz clic para cambiar el estado de pago"
                        >
                          {isPaid ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {isPaid ? 'Pagada' : 'Pendiente'}
                        </button>
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedInvoiceDetails(inv)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                            title="Ver detalles"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditInvoiceModal(inv)}
                            className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-lg transition cursor-pointer"
                            title="Editar factura"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteInvoice(inv)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- MODAL: REGISTRAR / EDITAR FACTURA --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-xl max-h-[92vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary" /> {editingInvoiceId ? 'Editar Factura de Proveedor' : 'Registrar Factura / Gasto'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Añade los datos fiscales de la compra o suministro para tu contabilidad.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitInvoice} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Nº Factura del Proveedor *</label>
                  <input
                    required
                    type="text"
                    value={form.invoice_number}
                    onChange={e => setForm({ ...form, invoice_number: e.target.value })}
                    placeholder="Ej: FAC-2026/894, 26-0043..."
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Proveedor / Acreedor *</label>
                  <input
                    required
                    type="text"
                    list="suppliers-list"
                    value={form.supplier_name}
                    onChange={e => setForm({ ...form, supplier_name: e.target.value })}
                    placeholder="Ej: L'Oréal, Iberdrola, Arrendador..."
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                  <datalist id="suppliers-list">
                    {suppliers.map(s => <option key={s.id} value={s.name} />)}
                  </datalist>
                </div>
              </div>

              {/* SELECTOR INTERACTIVO DE ALBARANES PENDIENTES */}
              {supplierPendingAlbaranes.length > 0 && (
                <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
                        <Package className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="font-bold text-gray-900 text-xs block">
                          Albaranes de entrega pendientes {form.supplier_name ? `de ${form.supplier_name}` : ''}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Selecciona los albaranes que te factura el proveedor en esta factura
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleSelectAllSupplierAlbaranes}
                        className="px-2 py-1 bg-white border border-amber-200 hover:bg-amber-100 rounded-lg text-[10px] font-bold text-amber-900 transition cursor-pointer"
                      >
                        Marcar todos
                      </button>
                      <button
                        type="button"
                        onClick={handleDeselectAllAlbaranes}
                        className="px-2 py-1 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg text-[10px] font-bold text-gray-600 transition cursor-pointer"
                      >
                        Desmarcar
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {supplierPendingAlbaranes.map(alb => {
                      const isSelected = selectedAlbaranNumbers.includes(alb.albaran_number)
                      return (
                        <div
                          key={alb.id}
                          onClick={() => handleToggleAlbaran(alb)}
                          className={cn(
                            "flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition select-none",
                            isSelected
                              ? "bg-amber-100/80 border-amber-300 shadow-2xs"
                              : "bg-white border-gray-200 hover:border-amber-200 hover:bg-amber-50/30"
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-gray-900">{alb.albaran_number}</span>
                                <span className="text-[10px] text-gray-400 font-medium">({alb.date})</span>
                                {alb.supplier && (
                                  <span className="text-[10px] bg-white px-1.5 py-0.2 rounded border border-gray-200 text-gray-600 font-semibold">
                                    {alb.supplier}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                {alb.totalUnits} uds ({alb.itemsCount} {alb.itemsCount === 1 ? 'producto' : 'productos'})
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="font-bold text-gray-900 text-xs">{alb.totalBase.toFixed(2)} €</span>
                            <span className="block text-[10px] text-gray-400">base est.</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {selectedAlbaranNumbers.length > 0 && (
                    <div className="pt-2 border-t border-amber-200/80 flex items-center justify-between text-[11px]">
                      <span className="text-amber-900 font-medium">
                        ✓ <strong>{selectedAlbaranNumbers.length}</strong> {selectedAlbaranNumbers.length === 1 ? 'albarán seleccionado' : 'albaranes seleccionados'}
                      </span>
                      <span className="text-amber-900 font-bold">
                        Base imponible auto-calculada (editable)
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Albarán o Albaranes que incluye esta factura <span className="text-gray-400 font-normal">(Opcional)</span>
                </label>
                <input
                  type="text"
                  value={form.albaran_number || ''}
                  onChange={e => setForm({ ...form, albaran_number: e.target.value })}
                  placeholder="Ej: ALB26-00004, ALB26-00005 (o déjalo en blanco si no aplica)"
                  className="w-full border border-gray-200 p-2.5 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none font-mono"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Se autocompleta al marcar los albaranes pendientes arriba o puedes escribirlo libremente.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Categoría del Gasto</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-xs bg-white font-medium"
                  >
                    {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Fecha de Factura *</label>
                  <input
                    required
                    type="date"
                    value={form.invoice_date}
                    onChange={e => setForm({ ...form, invoice_date: e.target.value })}
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* DESGLOSE FISCAL */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                <h4 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-primary" /> Importes y Desglose de Impuestos
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Base Imponible (€) *</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.base_amount}
                      onChange={e => setForm({ ...form, base_amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full border border-gray-200 p-2 rounded-lg text-sm font-bold bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Tipo de IVA</label>
                    <select
                      value={form.tax_rate}
                      onChange={e => setForm({ ...form, tax_rate: parseFloat(e.target.value) })}
                      className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white font-medium"
                    >
                      <option value={21}>21% (General - Cosmética/Servicios)</option>
                      <option value={10}>10% (Reducido)</option>
                      <option value={4}>4% (Superreducido)</option>
                      <option value={0}>0% (Exento / Sin IVA)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Retención IRPF (Alquileres)</label>
                    <select
                      value={form.irpf_rate}
                      onChange={e => setForm({ ...form, irpf_rate: parseFloat(e.target.value) })}
                      className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white font-medium"
                    >
                      <option value={0}>0% (Sin retención)</option>
                      <option value={19}>19% (Alquiler de local)</option>
                      <option value={15}>15% (Profesionales / Gestoría)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-gray-500">Cuota IVA: </span>
                    <span className="font-bold text-emerald-700">{calculatedAmounts.tax}€</span>
                    {parseFloat(calculatedAmounts.irpf) > 0 && (
                      <span className="ml-3 text-gray-500">Retención IRPF: <strong className="text-red-600">-{calculatedAmounts.irpf}€</strong></span>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-500 font-bold">Total Factura: </span>
                    <span className="text-base font-black text-gray-900">{calculatedAmounts.total}€</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Forma de Pago</label>
                  <select
                    value={form.payment_method}
                    onChange={e => {
                      const m = e.target.value
                      let newDueDate = form.due_date
                      let newStatus = form.payment_status
                      // Si selecciona pagaré y no tenía vencimiento fijado, preseleccionar 30 días y pendiente
                      if (m === 'promissory_note') {
                        if (!newDueDate || newDueDate === form.invoice_date) {
                          newDueDate = addDaysToDate(form.invoice_date, 30)
                        }
                        newStatus = 'pending'
                      }
                      setForm({ ...form, payment_method: m, due_date: newDueDate, payment_status: newStatus })
                    }}
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-xs bg-white font-medium"
                  >
                    {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Estado de Pago</label>
                  <select
                    value={form.payment_status}
                    onChange={e => setForm({ ...form, payment_status: e.target.value })}
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-xs bg-white font-medium"
                  >
                    <option value="paid">Pagada al momento</option>
                    <option value="pending">Pendiente de Pago / Aplazada</option>
                  </select>
                </div>
              </div>

              {/* VENCIMIENTO Y APLAZAMIENTO (PAGARÉ O RECIBO A 30, 60, 90 DÍAS) */}
              <div className="bg-gray-50/80 p-3.5 rounded-xl border border-gray-200 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block font-bold text-gray-700 text-xs flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary" /> Fecha de Vencimiento / Pago
                    </label>
                    <span className="text-[11px] text-gray-500">
                      ¿Cuándo se cobrará el pagaré o vence la factura?
                    </span>
                  </div>

                  {/* Botones rápidos de cálculo */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, due_date: form.invoice_date || new Date().toISOString().split('T')[0] })}
                      className="px-2 py-1 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg text-[10px] font-bold text-gray-700 transition cursor-pointer"
                    >
                      Al momento
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, due_date: addDaysToDate(form.invoice_date, 30) })}
                      className="px-2 py-1 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg text-[10px] font-bold text-primary transition cursor-pointer"
                    >
                      +30 días
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, due_date: addDaysToDate(form.invoice_date, 60) })}
                      className="px-2 py-1 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg text-[10px] font-bold text-primary transition cursor-pointer"
                    >
                      +60 días
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, due_date: addDaysToDate(form.invoice_date, 90) })}
                      className="px-2 py-1 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg text-[10px] font-bold text-primary transition cursor-pointer"
                    >
                      +90 días
                    </button>
                  </div>
                </div>

                <input
                  type="date"
                  value={form.due_date || ''}
                  onChange={e => setForm({ ...form, due_date: e.target.value })}
                  className="w-full border border-gray-200 p-2 rounded-xl text-xs bg-white focus:ring-2 focus:ring-primary/20 focus:outline-none font-medium"
                />

                {form.payment_method === 'promissory_note' && (
                  <p className="text-[11px] text-primary font-medium flex items-center gap-1 pt-0.5">
                    💡 Pagaré: haz clic en <strong>+30</strong>, <strong>+60</strong> o <strong>+90 días</strong> para calcular automáticamente el día exacto de vencimiento.
                  </p>
                )}
              </div>

              {/* Si es en efectivo, ofrecer reflejar en caja física */}
              {form.payment_method === 'cash' && !editingInvoiceId && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="reflect_in_cash"
                    checked={form.reflect_in_cash}
                    onChange={e => setForm({ ...form, reflect_in_cash: e.target.checked })}
                    className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
                  />
                  <label htmlFor="reflect_in_cash" className="text-xs font-bold text-amber-900 cursor-pointer">
                    Reflejar automáticamente como salida de efectivo en la Caja de hoy
                  </label>
                </div>
              )}

              <div>
                <label className="block font-bold text-gray-700 mb-1">Notas / Observaciones</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Detalles adicionales, número de albarán o vencimiento..."
                  className="w-full border border-gray-200 p-2 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-bold text-xs text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : editingInvoiceId ? 'Actualizar Factura' : 'Guardar Factura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: DETALLES DE FACTURA --- */}
      {selectedInvoiceDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Factura {selectedInvoiceDetails.invoice_number}</h3>
                <p className="text-xs text-gray-500">{selectedInvoiceDetails.supplier_name}</p>
              </div>
              <button onClick={() => setSelectedInvoiceDetails(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Fecha de Emisión:</span>
                <span className="font-bold text-gray-900">{selectedInvoiceDetails.invoice_date}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Categoría:</span>
                <span className="font-bold text-gray-900">{selectedInvoiceDetails.category}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Forma de Pago:</span>
                <span className="font-bold text-gray-900">
                  {PAYMENT_METHODS.find(m => m.id === selectedInvoiceDetails.payment_method)?.label || selectedInvoiceDetails.payment_method}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Estado:</span>
                <span className={`font-bold ${selectedInvoiceDetails.payment_status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {selectedInvoiceDetails.payment_status === 'paid' ? 'Pagada' : 'Pendiente de Pago'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Base Imponible:</span>
                <span className="font-bold text-gray-900">{(selectedInvoiceDetails.base_amount || 0).toFixed(2)}€</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">IVA ({selectedInvoiceDetails.tax_rate}%):</span>
                <span className="font-bold text-emerald-600">{(selectedInvoiceDetails.tax_amount || 0).toFixed(2)}€</span>
              </div>
              {parseFloat(selectedInvoiceDetails.irpf_amount) > 0 && (
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Retención IRPF ({selectedInvoiceDetails.irpf_rate}%):</span>
                  <span className="font-bold text-red-600">-{(selectedInvoiceDetails.irpf_amount || 0).toFixed(2)}€</span>
                </div>
              )}
              <div className="flex justify-between py-2 bg-gray-50 px-3 rounded-xl">
                <span className="font-bold text-gray-800">TOTAL FACTURA:</span>
                <span className="font-black text-gray-900 text-sm">{(selectedInvoiceDetails.total_amount || 0).toFixed(2)}€</span>
              </div>
              {selectedInvoiceDetails.notes && (
                <div className="pt-2">
                  <span className="text-gray-500 block mb-1">Notas:</span>
                  <p className="bg-gray-50 p-2.5 rounded-lg text-gray-700 italic">{selectedInvoiceDetails.notes}</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedInvoiceDetails(null)}
                className="bg-gray-900 text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-black"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
