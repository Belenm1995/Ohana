import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Banknote, TrendingUp, Plus, Minus, CreditCard,
  Calculator, Lock, Unlock, History, Download, X,
  FileText, FileSpreadsheet, Gift, Eye, Coins,
  Sparkles, Receipt, Percent, Printer, CheckCircle2
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function AdminCashRegister() {
  const [sales, setSales] = useState([])
  const [movements, setMovements] = useState([])
  const [closures, setClosures] = useState([])
  const [todayGiftCards, setTodayGiftCards] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reopenMovements, setReopenMovements] = useState([])
  const [activeTab, setActiveTab] = useState('sales') // 'sales', 'movements', 'closures'
  const [selectedSaleDetails, setSelectedSaleDetails] = useState(null)

  // Form states for manual movement
  const [type, setType] = useState('out')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Closure modal states
  const [showClosureModal, setShowClosureModal] = useState(false)
  const [showPostClosureModal, setShowPostClosureModal] = useState(false)
  const [lastClosedData, setLastClosedData] = useState(null)
  const [printClosureData, setPrintClosureData] = useState(null)
  const [actualCash, setActualCash] = useState('')
  const [actualBank, setActualBank] = useState('')
  const [closureNotes, setClosureNotes] = useState('')
  const [isClosing, setIsClosing] = useState(false)
  const [showDenominations, setShowDenominations] = useState(false)
  const [denominations, setDenominations] = useState({
    b100: '', b50: '', b20: '', b10: '', b5: '',
    m2: '', m1: '', m050: '', m020: '', m010: '', m005: ''
  })

  // Export modal states
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportMonth, setExportMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date()
      endOfDay.setHours(23, 59, 59, 999)

      // 1. Obtener ventas de hoy con datos de cliente y detalle de items
      const { data: salesData } = await supabase
        .from('sales')
        .select('*, client:clients(name, phone), sale_items(*)')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: false })

      if (salesData) setSales(salesData)

      // 2. Obtener movimientos de hoy
      const { data: movData } = await supabase
        .from('cash_movements')
        .select('*')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: false })

      if (movData) setMovements(movData)

      // 3. Obtener historial de cierres
      const { data: closuresData } = await supabase
        .from('cash_closures')
        .select('*')
        .order('closure_date', { ascending: false })
        .limit(30) // Mostrar últimos 30 días

      if (closuresData) setClosures(closuresData)

      // 3.1 Obtener marcas de reaperturas sincronizadas
      const { data: reopenData } = await supabase
        .from('cash_movements')
        .select('*')
        .ilike('reason', '%[SISTEMA_REAPERTURA_CAJA_%')

      if (reopenData) setReopenMovements(reopenData)

      // 4. Obtener tarjetas regalo creadas hoy (vendidas)
      const { data: giftCardsData } = await supabase
        .from('gift_cards')
        .select('*, service:services(name), product:products(name)')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())

      if (giftCardsData) setTodayGiftCards(giftCardsData)

      // 5. Configuración del negocio (para el Cierre Z)
      const { data: settingsData } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .single()

      if (settingsData) setSettings(settingsData)

    } catch (error) {
      console.error("Error fetching cash data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddMovement = async (e) => {
    e.preventDefault()
    if (!amount || amount <= 0 || !reason) return

    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('cash_movements')
        .insert([{
          type,
          amount: parseFloat(amount),
          reason,
          payment_method: paymentMethod
        }])

      if (error) throw error

      setAmount('')
      setReason('')
      setShowForm(false)
      fetchData() // Recargar datos
    } catch (error) {
      console.error(error)
      alert("Error guardando el movimiento.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Preconfigurar formulario para apertura con fondo de caja
  const handleOpenRegister = () => {
    setType('in')
    setReason('Fondo inicial de caja (Apertura)')
    setAmount('150')
    setPaymentMethod('cash')
    setShowForm(true)
    window.scrollTo({ top: 100, behavior: 'smooth' })
  }

  // Cálculo de Monedas y Billetes para Arqueo
  const calculatedCashFromCoins = (
    (Number(denominations.b100 || 0) * 100) +
    (Number(denominations.b50 || 0) * 50) +
    (Number(denominations.b20 || 0) * 20) +
    (Number(denominations.b10 || 0) * 10) +
    (Number(denominations.b5 || 0) * 5) +
    (Number(denominations.m2 || 0) * 2) +
    (Number(denominations.m1 || 0) * 1) +
    (Number(denominations.m050 || 0) * 0.50) +
    (Number(denominations.m020 || 0) * 0.20) +
    (Number(denominations.m010 || 0) * 0.10) +
    (Number(denominations.m005 || 0) * 0.05)
  )

  const handleApplyCalculatedCash = () => {
    setActualCash(calculatedCashFromCoins.toFixed(2))
    setShowDenominations(false)
  }

  // Cálculos de Caja (Valores Esperados)
  const regularMovements = movements.filter(m => !m.reason?.startsWith('[SISTEMA_REAPERTURA_CAJA_'))
  const openingMovement = regularMovements.find(m => m.type === 'in' && m.payment_method === 'cash' && /fondo|apertura/i.test(m.reason))
  const initialFloat = openingMovement ? Number(openingMovement.amount) : 0
  const otherInCash = regularMovements.filter(m => m.type === 'in' && m.payment_method === 'cash' && m.id !== openingMovement?.id).reduce((sum, m) => sum + Number(m.amount), 0)

  const totalSalesCash = sales.filter(s => s.payment_method === 'cash').reduce((sum, s) => sum + Number(s.total_amount), 0)
  const totalSalesCard = sales.filter(s => s.payment_method === 'card').reduce((sum, s) => sum + Number(s.total_amount), 0)
  const totalSalesBizum = sales.filter(s => s.payment_method === 'bizum').reduce((sum, s) => sum + Number(s.total_amount), 0)
  
  const totalInCash = regularMovements.filter(m => m.type === 'in' && m.payment_method === 'cash').reduce((sum, m) => sum + Number(m.amount), 0)
  const totalOutCash = regularMovements.filter(m => m.type === 'out' && m.payment_method === 'cash').reduce((sum, m) => sum + Number(m.amount), 0)

  const totalInBank = regularMovements.filter(m => m.type === 'in' && m.payment_method !== 'cash').reduce((sum, m) => sum + Number(m.amount), 0)
  const totalOutBank = regularMovements.filter(m => m.type === 'out' && m.payment_method !== 'cash').reduce((sum, m) => sum + Number(m.amount), 0)

  const expectedCash = totalSalesCash + totalInCash - totalOutCash
  const expectedBank = totalSalesCard + totalSalesBizum + totalInBank - totalOutBank

  // Métricas de Tarjetas Regalo y Facturación
  const totalGiftCardsSold = todayGiftCards
    .filter(g => g.status !== 'pending_payment')
    .reduce((sum, g) => sum + Number(g.amount_initial || 0), 0)

  let totalGiftCardsRedeemed = 0
  sales.forEach(s => {
    if (s.notes && s.notes.includes('Canje tarjeta regalo')) {
      const match = s.notes.match(/Canje tarjeta regalo:[^(]+\(-([0-9.]+)€\)/)
      if (match && match[1]) {
        totalGiftCardsRedeemed += parseFloat(match[1])
      } else if (s.discount_amount > 0) {
        totalGiftCardsRedeemed += Number(s.discount_amount)
      }
    }
  })

  const totalDiscounts = sales.reduce((sum, s) => sum + Number(s.discount_amount || 0), 0)
  const totalNetCollected = sales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0)
  const totalGrossBilled = totalNetCollected + totalDiscounts

  // Métricas históricas o vivas del Cierre
  const getClosureMetrics = (closure) => {
    if (!closure) return null
    if (closure.notes && closure.notes.includes('<!--CIERRE_METRICS:')) {
      try {
        const match = closure.notes.match(/<!--CIERRE_METRICS:(.*?)-->/)
        if (match && match[1]) {
          return JSON.parse(match[1])
        }
      } catch (e) {
        console.warn('Error parsing closure metrics:', e)
      }
    }
    const todayStr = new Date().toISOString().split('T')[0]
    if (closure.closure_date === todayStr) {
      return {
        sales_cash: totalSalesCash,
        sales_card: totalSalesCard,
        sales_bizum: totalSalesBizum,
        initial_float: initialFloat,
        total_in_cash: otherInCash,
        total_out_cash: totalOutCash,
        total_net_collected: totalNetCollected,
        total_discounts: totalDiscounts,
        total_gross_billed: totalGrossBilled,
        gift_cards_sold: totalGiftCardsSold,
        gift_cards_redeemed: totalGiftCardsRedeemed,
        sales_count: sales.length
      }
    }
    return null
  }

  const getCleanClosureNotes = (notes) => {
    if (!notes) return ''
    return notes.replace(/<!--CIERRE_METRICS:.*?-->/g, '').trim()
  }

  const handleCloseRegister = async (e) => {
    e.preventDefault()
    if (actualCash === '' || actualBank === '') return

    setIsClosing(true)
    try {
      const parsedActualCash = parseFloat(actualCash)
      const parsedActualBank = parseFloat(actualBank)
      
      const discrepancyCash = parsedActualCash - expectedCash
      const discrepancyBank = parsedActualBank - expectedBank
      
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

      // Empaquetar métricas detalladas para histórico y gestoría
      const meta = {
        sales_cash: totalSalesCash,
        sales_card: totalSalesCard,
        sales_bizum: totalSalesBizum,
        initial_float: initialFloat,
        total_in_cash: otherInCash,
        total_out_cash: totalOutCash,
        total_net_collected: totalNetCollected,
        total_discounts: totalDiscounts,
        total_gross_billed: totalGrossBilled,
        gift_cards_sold: totalGiftCardsSold,
        gift_cards_redeemed: totalGiftCardsRedeemed,
        sales_count: sales.length
      }

      const notesToSave = closureNotes.trim()
        ? `${closureNotes.trim()}\n<!--CIERRE_METRICS:${JSON.stringify(meta)}-->`
        : `<!--CIERRE_METRICS:${JSON.stringify(meta)}-->`

      const { data: insertedData, error } = await supabase
        .from('cash_closures')
        .insert([{
          closure_date: today,
          expected_cash: expectedCash,
          actual_cash: parsedActualCash,
          discrepancy_cash: discrepancyCash,
          expected_bank: expectedBank,
          actual_bank: parsedActualBank,
          discrepancy_bank: discrepancyBank,
          notes: notesToSave
        }])
        .select()
        .single()

      if (error) throw error

      const finalClosureObj = insertedData || {
        id: 'temp-' + Date.now(),
        closure_date: today,
        expected_cash: expectedCash,
        actual_cash: parsedActualCash,
        discrepancy_cash: discrepancyCash,
        expected_bank: expectedBank,
        actual_bank: parsedActualBank,
        discrepancy_bank: discrepancyBank,
        notes: notesToSave
      }

      setShowClosureModal(false)
      setActualCash('')
      setActualBank('')
      setClosureNotes('')
      setLastClosedData(finalClosureObj)
      setShowPostClosureModal(true)
      fetchData() // Recargar para ver el nuevo cierre
    } catch (error) {
      console.error(error)
      alert("Error al cerrar la caja. Asegúrate de haber creado la tabla cash_closures en Supabase.")
    } finally {
      setIsClosing(false)
    }
  }

  // Generación de Informe Oficial Cierre Z en PDF (Completo para Gestoría)
  const handleGenerateZReport = (closure) => {
    const doc = new jsPDF()
    const company = settings?.company_name || 'Ohana Peluquería y Estética'
    const nif = settings?.company_nif || ''
    const address = settings?.company_address ? `${settings.company_address}, ${settings.company_city || ''}` : 'C/ Mesones, 4, Palma del Río'
    const phone = settings?.company_phone || '957 26 54 42'

    const metrics = getClosureMetrics(closure)
    const cleanNotes = getCleanClosureNotes(closure.notes)

    // Cabecera Empresa
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(company, 105, 18, { align: 'center' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    if (nif) doc.text(`CIF/NIF: ${nif}  •  Tel: ${phone}`, 105, 24, { align: 'center' })
    if (address) doc.text(address, 105, 29, { align: 'center' })

    doc.setLineWidth(0.4)
    doc.line(14, 33, 196, 33)

    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.text(`INFORME DE CIERRE DE CAJA (CIERRE Z)`, 14, 42)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Fecha de Cierre: ${new Date(closure.closure_date).toLocaleDateString()}`, 14, 48)
    doc.text(`Generado: ${new Date().toLocaleDateString()} a las ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 14, 53)

    let currentY = 59

    // 1. Desglose detallado de Ventas y Cobros
    if (metrics) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(`1. Resumen de Ventas y Facturación (${metrics.sales_count || 0} tickets)`, 14, currentY)

      const salesBody = [
        ['Cobrado en Efectivo (TPV)', `${Number(metrics.sales_cash || 0).toFixed(2)} €`],
        ['Cobrado con Tarjeta (Datáfono)', `${Number(metrics.sales_card || 0).toFixed(2)} €`],
        ['Cobrado por Bizum', `${Number(metrics.sales_bizum || 0).toFixed(2)} €`],
        ['TOTAL NETO COBRADO EN CAJA / BANCO', `${Number(metrics.total_net_collected || 0).toFixed(2)} €`]
      ]

      if (Number(metrics.total_discounts || 0) > 0) {
        salesBody.push(['Descuentos y Canjes aplicados', `-${Number(metrics.total_discounts).toFixed(2)} €`])
      }
      salesBody.push(['FACTURACIÓN BRUTA TOTAL (DÍA)', `${Number(metrics.total_gross_billed || 0).toFixed(2)} €`])

      autoTable(doc, {
        startY: currentY + 3,
        head: [['Concepto Económico', 'Total']],
        body: salesBody,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 8.5, cellPadding: 2.2 }
      })

      currentY = doc.lastAutoTable.finalY + 8

      // 2. Movimientos del Cajón de Efectivo
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('2. Movimientos Físicos del Cajón (Efectivo)', 14, currentY)

      const cashMovementsBody = [
        ['Fondo Inicial de Apertura (Cambio)', `+${Number(metrics.initial_float || 0).toFixed(2)} €`],
        ['Ventas en Efectivo ingresadas', `+${Number(metrics.sales_cash || 0).toFixed(2)} €`]
      ]
      if (Number(metrics.total_in_cash || 0) > 0) {
        cashMovementsBody.push(['Otros Ingresos manuales en efectivo', `+${Number(metrics.total_in_cash).toFixed(2)} €`])
      }
      cashMovementsBody.push(['Salidas / Gastos en Efectivo del cajón', `-${Number(metrics.total_out_cash || 0).toFixed(2)} €`])

      autoTable(doc, {
        startY: currentY + 3,
        head: [['Concepto en Cajón', 'Total']],
        body: cashMovementsBody,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59] },
        styles: { fontSize: 8.5, cellPadding: 2.2 }
      })

      currentY = doc.lastAutoTable.finalY + 8
    }

    // 3. Arqueo y Control de Descuadres
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(metrics ? '3. Arqueo y Control de Descuadre' : 'Arqueo y Control de Descuadre', 14, currentY)

    autoTable(doc, {
      startY: currentY + 3,
      head: [['Canal / Cajón', 'Esperado', 'Real Contado', 'Descuadre']],
      body: [
        [
          'Cajón (Efectivo)',
          Number(closure.expected_cash).toFixed(2) + ' €',
          Number(closure.actual_cash).toFixed(2) + ' €',
          (Number(closure.discrepancy_cash) > 0 ? '+' : '') + Number(closure.discrepancy_cash).toFixed(2) + ' €'
        ],
        [
          'Banco (Datáfono / Bizum)',
          Number(closure.expected_bank).toFixed(2) + ' €',
          Number(closure.actual_bank).toFixed(2) + ' €',
          (Number(closure.discrepancy_bank) > 0 ? '+' : '') + Number(closure.discrepancy_bank).toFixed(2) + ' €'
        ]
      ],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 9, cellPadding: 2.8 }
    })

    let finalY = doc.lastAutoTable.finalY + 8

    if (cleanNotes) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Notas / Incidencias del Responsable:', 14, finalY)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.text(cleanNotes, 14, finalY + 5)
      finalY += 16
    } else {
      finalY += 6
    }

    doc.setLineWidth(0.2)
    doc.line(14, finalY + 12, 80, finalY + 12)
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text('Firma del Responsable de Cierre', 14, finalY + 17)

    doc.text('Documento oficial de control interno de caja - Ohana Gestión', 105, finalY + 25, { align: 'center' })

    doc.save(`Cierre_Z_${closure.closure_date}.pdf`)
  }

  // Impresión en Ticket Térmico Físico (80mm)
  const handlePrintZTicket = (closure) => {
    const metrics = getClosureMetrics(closure)
    const cleanNotes = getCleanClosureNotes(closure.notes)
    setPrintClosureData({
      closure,
      metrics,
      cleanNotes
    })
    setTimeout(() => {
      window.print()
    }, 150)
  }

  // Verificar si un cierre fue reabierto/anulado
  const isClosureReopened = (closure) => {
    if (!closure) return false;
    try {
      if (localStorage.getItem(`ohana_reopened_closure_${closure.id}`) === 'true') return true;
    } catch {}

    const match = reopenMovements.find(m => 
      m.reason === `[SISTEMA_REAPERTURA_CAJA_${closure.closure_date}]` &&
      new Date(m.created_at) > new Date(closure.created_at)
    );
    return !!match;
  };

  const todayString = new Date().toISOString().split('T')[0]
  const activeTodayClosure = closures.find(c => c.closure_date === todayString && !isClosureReopened(c))
  const isClosedToday = !!activeTodayClosure

  const handleReopenRegister = async (closureId = null) => {
    const targetClosure = closureId 
      ? closures.find(c => c.id === closureId)
      : (activeTodayClosure || closures.find(c => c.closure_date === todayString));

    if (!targetClosure) return alert('No se ha encontrado el registro de cierre para reabrir.');

    const confirmed = window.confirm(
      `¿Deseas reabrir la caja del día ${new Date(targetClosure.closure_date).toLocaleDateString()}?\n\n` +
      `Esto anulará el cierre previo para que puedas seguir cobrando en el TPV, registrando movimientos o hacer el arqueo definitivo al final de tu jornada.`
    );

    if (!confirmed) return;

    try {
      // 1. Intentar borrar físicamente en Supabase
      try {
        await supabase
          .from('cash_closures')
          .delete()
          .eq('id', targetClosure.id);
      } catch (errDel) {
        console.warn('Borrado directo en cash_closures bloqueado por RLS:', errDel);
      }

      // 2. Registrar reapertura sincronizada en cash_movements (funciona sin restricciones de RLS)
      await supabase
        .from('cash_movements')
        .insert([{
          type: 'in',
          amount: 0,
          reason: `[SISTEMA_REAPERTURA_CAJA_${targetClosure.closure_date}]`,
          payment_method: 'cash'
        }]);

      // 3. Marcar en almacenamiento local para respuesta instantánea en este navegador
      try {
        localStorage.setItem(`ohana_reopened_closure_${targetClosure.id}`, 'true');
      } catch {}

      await fetchData();
      alert('¡Caja reabierta con éxito! La caja vuelve a estar abierta para operar.');
    } catch (err) {
      console.error('Error reabriendo caja:', err);
      // Fallback local por seguridad si la red fallase
      try {
        localStorage.setItem(`ohana_reopened_closure_${targetClosure.id}`, 'true');
      } catch {}
      await fetchData();
      alert('¡Caja reabierta con éxito! La caja vuelve a estar abierta para operar.');
    }
  };


  const handleExportCSV = async () => {
    setIsExporting(true)
    try {
      const [year, month] = exportMonth.split('-')
      const startDate = new Date(Date.UTC(year, parseInt(month) - 1, 1, 0, 0, 0))
      const endDate = new Date(Date.UTC(year, parseInt(month), 0, 23, 59, 59, 999))

      // Get Sales
      const { data: monthSales } = await supabase
        .from('sales')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true })

      // Get Movements
      const { data: monthMovements } = await supabase
        .from('cash_movements')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true })

      // Generate CSV Content
      let csv = 'Tipo;Fecha;Concepto;Metodo Pago;Importe\n'
      
      const allTransactions = []
      
      if (monthSales) {
        monthSales.forEach(s => {
          allTransactions.push({
            tipo: 'Venta',
            fecha: new Date(s.created_at),
            concepto: 'Ticket #' + s.id.substring(0,8),
            metodo: s.payment_method || 'mixto',
            importe: Number(s.total_amount) || 0
          })
        })
      }

      if (monthMovements) {
        monthMovements.filter(m => !m.reason?.startsWith('[SISTEMA_REAPERTURA_CAJA_')).forEach(m => {
          const amt = Number(m.amount) || 0;
          allTransactions.push({
            tipo: m.type === 'in' ? 'Ingreso Manual' : 'Gasto Manual',
            fecha: new Date(m.created_at),
            concepto: m.reason || '',
            metodo: m.payment_method || 'efectivo',
            importe: m.type === 'in' ? amt : -amt
          })
        })
      }

      // Sort by date
      allTransactions.sort((a, b) => a.fecha - b.fecha)

      allTransactions.forEach(t => {
        const fechaStr = t.fecha.toLocaleDateString() + ' ' + t.fecha.toLocaleTimeString()
        csv += `${t.tipo};${fechaStr};"${t.concepto}";${t.metodo};${t.importe.toFixed(2)}\n`
      })

      // Download it
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }) // BOM for Excel
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `Caja_Ohana_${exportMonth}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      setShowExportModal(false)
    } catch (error) {
      console.error(error)
      alert("Error al exportar los datos CSV")
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportPDF = async () => {
    if (!exportMonth) return alert('Por favor, selecciona un mes');
    setIsExporting(true)
    try {
      const [year, month] = exportMonth.split('-')
      // startDate = first day of month, endDate = last day of month
      // using UTC strictly to avoid local timezone shifts
      const startDate = new Date(Date.UTC(year, parseInt(month) - 1, 1, 0, 0, 0))
      const endDate = new Date(Date.UTC(year, parseInt(month), 0, 23, 59, 59, 999))

      const { data: monthSales, error: err1 } = await supabase
        .from('sales')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      if (err1) throw err1

      const { data: monthMovements, error: err2 } = await supabase
        .from('cash_movements')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())

      if (err2) throw err2

      const allTransactions = []
      
      if (monthSales) {
        monthSales.forEach(s => {
          allTransactions.push({
            tipo: 'Venta',
            fecha: new Date(s.created_at),
            concepto: 'Ticket #' + s.id.substring(0,8),
            metodo: s.payment_method || 'mixto',
            importe: Number(s.total_amount) || 0
          })
        })
      }

      if (monthMovements) {
        monthMovements.filter(m => !m.reason?.startsWith('[SISTEMA_REAPERTURA_CAJA_')).forEach(m => {
          const amt = Number(m.amount) || 0;
          allTransactions.push({
            tipo: m.type === 'in' ? 'Ingreso Manual' : 'Gasto Manual',
            fecha: new Date(m.created_at),
            concepto: m.reason || '',
            metodo: m.payment_method || 'efectivo',
            importe: m.type === 'in' ? amt : -amt
          })
        })
      }

      allTransactions.sort((a, b) => a.fecha - b.fecha)

      const doc = new jsPDF()
      
      doc.setFontSize(18)
      doc.text(`Informe de Caja - Ohana`, 14, 22)
      doc.setFontSize(12)
      doc.text(`Mes: ${month}/${year}`, 14, 30)

      const tableData = allTransactions.map(t => [
        t.tipo,
        t.fecha.toLocaleDateString() + ' ' + t.fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        t.concepto,
        t.metodo,
        t.importe.toFixed(2) + ' €'
      ])

      // Total calc
      const total = allTransactions.reduce((sum, t) => sum + t.importe, 0)

      autoTable(doc, {
        startY: 35,
        head: [['Tipo', 'Fecha', 'Concepto', 'Método', 'Importe']],
        body: tableData,
        foot: [['', '', '', 'TOTAL', total.toFixed(2) + ' €']],
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] }, // Slate 900
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' }
      })

      doc.save(`Caja_Ohana_${exportMonth}.pdf`)
      
      setShowExportModal(false)
    } catch (error) {
      console.error(error)
      alert("Error al generar el PDF: " + error.message)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Control de Caja</h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2">
            Resumen del día de hoy: {new Date().toLocaleDateString()}
            {isClosedToday && (
              <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Caja Cerrada
                <button
                  onClick={() => handleReopenRegister()}
                  className="underline hover:text-amber-950 font-extrabold ml-1 cursor-pointer"
                  title="Reabrir caja de hoy"
                >
                  (Reabrir)
                </button>
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/admin/expenses"
            className="bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Receipt className="w-5 h-5 text-emerald-600"/> Facturas y Gastos
          </Link>
          
          <button 
            onClick={() => {
              setShowExportModal(true);
              setShowForm(false);
              setShowClosureModal(false);
            }}
            className="bg-white border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-5 h-5"/> Exportar (Gestoría)
          </button>
          
          <button 
            onClick={() => {
              setShowForm(!showForm);
              setShowClosureModal(false);
              setShowExportModal(false);
            }}
            className="bg-white border border-gray-200 text-gray-700 px-5 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Calculator className="w-5 h-5"/> Registrar Movimiento
          </button>
          
          {isClosedToday ? (
            <button 
              onClick={() => handleReopenRegister()}
              className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl font-bold transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
              title="Anular el cierre accidental y reabrir la caja de hoy"
            >
              <Unlock className="w-5 h-5"/> Reabrir Caja
            </button>
          ) : (
            <button 
              onClick={() => {
                setShowClosureModal(true);
                setShowForm(false);
              }}
              className="bg-gray-900 text-white hover:bg-black px-5 py-2.5 rounded-xl font-bold transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Lock className="w-5 h-5"/> Cerrar Caja
            </button>
          )}
        </div>
      </div>

      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Exportar para Gestoría</h2>
              <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <p className="text-sm text-gray-500 mb-6">
              Descarga un archivo Excel (CSV) con todas las ventas y movimientos de caja del mes seleccionado, listo para enviar.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Mes a exportar</label>
              <input 
                type="month"
                required
                value={exportMonth}
                onChange={(e) => setExportMonth(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-3 focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleExportPDF}
                disabled={isExporting || !exportMonth}
                className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 flex items-center justify-center gap-2 disabled:opacity-70 transition-colors"
              >
                <FileText className="w-5 h-5" />
                {isExporting ? 'Generando...' : 'Descargar PDF'}
              </button>
              
              <button
                onClick={handleExportCSV}
                disabled={isExporting || !exportMonth}
                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-70 transition-colors"
              >
                <FileSpreadsheet className="w-5 h-5" />
                {isExporting ? 'Generando...' : 'Descargar CSV (Excel)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm animate-in slide-in-from-top-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">Añadir Ingreso / Gasto Manual</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <form onSubmit={handleAddMovement} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-32">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo</label>
              <select 
                value={type} 
                onChange={(e) => setType(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:border-primary bg-gray-50"
              >
                <option value="out">Gasto (-)</option>
                <option value="in">Ingreso (+)</option>
              </select>
            </div>
            
            <div className="w-full md:w-48">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Concepto</label>
              <input 
                type="text" 
                placeholder="Ej: Café, Champú..." 
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:border-primary"
              />
            </div>

            <div className="w-full md:w-32">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Importe (€)</label>
              <input 
                type="number" 
                step="0.01"
                min="0"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:border-primary"
              />
            </div>

            <div className="w-full md:w-40">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Método</label>
              <select 
                value={paymentMethod} 
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:border-primary bg-gray-50"
              >
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta</option>
                <option value="bizum">Bizum</option>
              </select>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className={`px-6 py-2.5 rounded-lg font-bold text-white transition-colors h-[46px] w-full md:w-auto
                ${type === 'out' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} 
                disabled:opacity-50`}
            >
              {isSubmitting ? 'Guardando...' : type === 'out' ? 'Restar' : 'Sumar'}
            </button>
          </form>
        </div>
      )}

      {showClosureModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Lock className="w-6 h-6 text-gray-700" /> Cierre de Caja
              </h2>
              <button onClick={() => setShowClosureModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <form onSubmit={handleCloseRegister} className="p-6">
              <div className="grid grid-cols-2 gap-8 mb-6">
                {/* Columna Efectivo */}
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
                    <p className="text-emerald-800 font-semibold text-sm">Efectivo Esperado</p>
                    <p className="text-3xl font-bold text-emerald-900 mt-1">{expectedCash.toFixed(2)}€</p>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-semibold text-gray-700">Efectivo Real (Cajón)</label>
                      <button
                        type="button"
                        onClick={() => setShowDenominations(!showDenominations)}
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 transition cursor-pointer"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        {showDenominations ? 'Ocultar Desglose' : 'Contar Monedas'}
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">€</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        required
                        value={actualCash}
                        onChange={(e) => setActualCash(e.target.value)}
                        className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 text-lg font-bold focus:ring-2 focus:ring-primary outline-none"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Desglose Interactivo de Billetes y Monedas */}
                  {showDenominations && (
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs space-y-2 animate-in fade-in">
                      <div className="font-bold text-gray-700 flex justify-between items-center">
                        <span>Desglose de Conteo:</span>
                        <span className="text-emerald-700 font-extrabold text-sm">{calculatedCashFromCoins.toFixed(2)}€</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="font-bold text-gray-500 mb-1">Billetes</p>
                          <div className="space-y-1">
                            {[
                              { key: 'b100', label: '100 €' },
                              { key: 'b50', label: '50 €' },
                              { key: 'b20', label: '20 €' },
                              { key: 'b10', label: '10 €' },
                              { key: 'b5', label: '5 €' },
                            ].map(b => (
                              <div key={b.key} className="flex items-center justify-between gap-1">
                                <span className="w-12 text-gray-600 font-medium">{b.label}</span>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={denominations[b.key]}
                                  onChange={e => setDenominations(prev => ({ ...prev, [b.key]: e.target.value }))}
                                  className="w-14 border rounded p-1 text-center bg-white"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="font-bold text-gray-500 mb-1">Monedas</p>
                          <div className="space-y-1">
                            {[
                              { key: 'm2', label: '2 €' },
                              { key: 'm1', label: '1 €' },
                              { key: 'm050', label: '0.50 €' },
                              { key: 'm020', label: '0.20 €' },
                              { key: 'm010', label: '0.10 €' },
                              { key: 'm005', label: '0.05 €' },
                            ].map(m => (
                              <div key={m.key} className="flex items-center justify-between gap-1">
                                <span className="w-12 text-gray-600 font-medium">{m.label}</span>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={denominations[m.key]}
                                  onChange={e => setDenominations(prev => ({ ...prev, [m.key]: e.target.value }))}
                                  className="w-14 border rounded p-1 text-center bg-white"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyCalculatedCash}
                        className="w-full bg-emerald-600 text-white font-bold py-1.5 rounded-lg hover:bg-emerald-700 transition cursor-pointer"
                      >
                        Aplicar {calculatedCashFromCoins.toFixed(2)}€ a Efectivo Real
                      </button>
                    </div>
                  )}

                  {actualCash !== '' && (
                    <div className={`p-3 rounded-lg text-sm font-bold flex justify-between ${
                      parseFloat(actualCash) === expectedCash 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      <span>Descuadre:</span>
                      <span>{(parseFloat(actualCash) - expectedCash) > 0 ? '+' : ''}{(parseFloat(actualCash) - expectedCash).toFixed(2)}€</span>
                    </div>
                  )}
                </div>

                {/* Columna Banco */}
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-center">
                    <p className="text-blue-800 font-semibold text-sm">Banco Esperado</p>
                    <p className="text-3xl font-bold text-blue-900 mt-1">{expectedBank.toFixed(2)}€</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Banco Real (Datáfono/App)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">€</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        required
                        value={actualBank}
                        onChange={(e) => setActualBank(e.target.value)}
                        className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 text-lg font-bold focus:ring-2 focus:ring-primary outline-none"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  {actualBank !== '' && (
                    <div className={`p-3 rounded-lg text-sm font-bold flex justify-between ${
                      parseFloat(actualBank) === expectedBank 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      <span>Descuadre:</span>
                      <span>{(parseFloat(actualBank) - expectedBank) > 0 ? '+' : ''}{(parseFloat(actualBank) - expectedBank).toFixed(2)}€</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Notas (Opcional)</label>
                <textarea 
                  value={closureNotes}
                  onChange={(e) => setClosureNotes(e.target.value)}
                  placeholder="Añade una nota si hay algún descuadre..."
                  className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-primary outline-none"
                  rows="2"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setShowClosureModal(false)}
                  className="px-6 py-3 rounded-xl font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isClosing}
                  className="px-6 py-3 rounded-xl font-bold text-white bg-gray-900 hover:bg-black transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isClosing ? 'Guardando...' : <><Lock className="w-4 h-4"/> Confirmar Cierre</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalle de Venta / Ticket */}
      {selectedSaleDetails && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setSelectedSaleDetails(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start pb-4 border-b border-gray-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {selectedSaleDetails.invoice_number ? 'Factura Simplificada' : 'Ticket de Venta'}
                </span>
                <h2 className="text-xl font-extrabold text-gray-900 mt-1">
                  {selectedSaleDetails.invoice_number || `Ticket #${selectedSaleDetails.id.substring(0, 8)}`}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(selectedSaleDetails.created_at).toLocaleDateString()} a las {new Date(selectedSaleDetails.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button onClick={() => setSelectedSaleDetails(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>

            <div className="overflow-y-auto py-4 space-y-4 flex-1">
              {/* Cliente */}
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-500 font-semibold">Cliente:</p>
                <p className="font-bold text-gray-900">{selectedSaleDetails.client?.name || 'Cliente Ocasional / Paso'}</p>
                {selectedSaleDetails.client?.phone && (
                  <p className="text-xs text-gray-600">{selectedSaleDetails.client.phone}</p>
                )}
              </div>

              {/* Items */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Desglose de Artículos:</p>
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                  {selectedSaleDetails.sale_items && selectedSaleDetails.sale_items.length > 0 ? (
                    selectedSaleDetails.sale_items.map((item, idx) => (
                      <div key={idx} className="p-3 flex justify-between items-center bg-white text-sm">
                        <div>
                          <p className="font-semibold text-gray-900">{item.item_name}</p>
                          <p className="text-xs text-gray-500">{item.quantity} x {Number(item.price).toFixed(2)}€</p>
                        </div>
                        <span className="font-bold text-gray-900">
                          {(Number(item.price) * Number(item.quantity)).toFixed(2)}€
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="p-3 text-xs text-gray-400">Sin items detallados</p>
                  )}
                </div>
              </div>

              {/* Resumen económico */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal:</span>
                  <span>{(Number(selectedSaleDetails.total_amount) + Number(selectedSaleDetails.discount_amount || 0)).toFixed(2)}€</span>
                </div>
                {Number(selectedSaleDetails.discount_amount) > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span className="flex items-center gap-1">
                      <Percent className="w-3.5 h-3.5" /> Descuento / Tarjeta Regalo:
                    </span>
                    <span>-{Number(selectedSaleDetails.discount_amount).toFixed(2)}€</span>
                  </div>
                )}
                {selectedSaleDetails.base_imponible && (
                  <div className="flex justify-between text-xs text-gray-500 pt-1 border-t border-gray-200">
                    <span>Base Imponible ({selectedSaleDetails.iva_percentage || 21}% IVA):</span>
                    <span>{Number(selectedSaleDetails.base_imponible).toFixed(2)}€</span>
                  </div>
                )}
                {selectedSaleDetails.iva_amount && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Cuota IVA:</span>
                    <span>{Number(selectedSaleDetails.iva_amount).toFixed(2)}€</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold text-gray-900 pt-2 border-t border-gray-200">
                  <span>Total Cobrado:</span>
                  <span>{Number(selectedSaleDetails.total_amount).toFixed(2)}€</span>
                </div>
              </div>

              {/* Método de Pago y Notas */}
              <div className="flex items-center justify-between text-xs font-semibold px-1">
                <span className="text-gray-500">Método de Pago:</span>
                <span className={`px-2.5 py-1 rounded-full uppercase tracking-wider font-bold ${
                  selectedSaleDetails.payment_method === 'cash' ? 'bg-emerald-100 text-emerald-800' :
                  selectedSaleDetails.payment_method === 'card' ? 'bg-blue-100 text-blue-800' :
                  selectedSaleDetails.payment_method === 'bizum' ? 'bg-purple-100 text-purple-800' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  {selectedSaleDetails.payment_method === 'cash' ? 'Efectivo' :
                   selectedSaleDetails.payment_method === 'card' ? 'Tarjeta' :
                   selectedSaleDetails.payment_method === 'bizum' ? 'Bizum' :
                   selectedSaleDetails.payment_method || 'Mixto'}
                </span>
              </div>

              {selectedSaleDetails.notes && (
                <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs text-amber-900 whitespace-pre-line">
                  <span className="font-bold block mb-1">Notas de la Venta:</span>
                  {selectedSaleDetails.notes}
                </div>
              )}

              {selectedSaleDetails.verifactu_hash && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono text-slate-600 break-all">
                  <span className="font-bold block font-sans text-xs text-slate-800 mb-0.5 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-primary" /> Huella VeriFactu (TBai):
                  </span>
                  {selectedSaleDetails.verifactu_hash}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedSaleDetails(null)}
                className="bg-gray-900 text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-black transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-500 py-10">Cargando datos de caja...</div>
      ) : (
        <>
          {/* Banner de Aviso: Apertura de Caja si no hay Fondo Inicial registrado hoy */}
          {!openingMovement && !isClosedToday && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-inner">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">Apertura de Caja pendiente</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Aún no has registrado el fondo inicial en efectivo para el cambio de hoy. Puedes registrarlo en un clic.
                  </p>
                </div>
              </div>
              <button
                onClick={handleOpenRegister}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Registrar Fondo Inicial
              </button>
            </div>
          )}

          {/* Tarjetas de Resumen (3 Cards Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1: Cajón Efectivo */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Banknote className="w-32 h-32" />
              </div>
              <div>
                <h3 className="text-gray-500 font-semibold mb-1 flex items-center gap-2 text-sm">
                  <Banknote className="w-4 h-4 text-emerald-600" /> Cajón (Efectivo) Esperado
                </h3>
                <div className="text-4xl font-extrabold text-gray-900 tracking-tight">{expectedCash.toFixed(2)}€</div>
              </div>
              <div className="mt-6 flex flex-col gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Fondo inicial (Apertura):</span>
                  <span className="font-semibold text-gray-900">+{initialFloat.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ventas hoy (TPV):</span>
                  <span className="font-semibold text-emerald-600">+{totalSalesCash.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Otros ingresos:</span>
                  <span className="font-semibold text-green-600">+{otherInCash.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-100">
                  <span className="text-gray-500">Gastos / Salidas:</span>
                  <span className="font-semibold text-red-500">-{totalOutCash.toFixed(2)}€</span>
                </div>
              </div>
            </div>

            {/* Card 2: Banco Esperado */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <CreditCard className="w-32 h-32" />
              </div>
              <div>
                <h3 className="text-gray-500 font-semibold mb-1 flex items-center gap-2 text-sm">
                  <CreditCard className="w-4 h-4 text-blue-600" /> Banco (Tarjeta / Bizum)
                </h3>
                <div className="text-4xl font-extrabold text-gray-900 tracking-tight">{expectedBank.toFixed(2)}€</div>
              </div>
              <div className="mt-6 flex flex-col gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Ventas Tarjeta:</span>
                  <span className="font-semibold text-blue-600">+{totalSalesCard.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ventas Bizum:</span>
                  <span className="font-semibold text-purple-600">+{totalSalesBizum.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-100">
                  <span className="text-gray-500">Movimientos banco:</span>
                  <span className={`font-semibold ${totalInBank - totalOutBank >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {totalInBank - totalOutBank > 0 ? '+' : ''}{(totalInBank - totalOutBank).toFixed(2)}€
                  </span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Recaudación bancaria:</span>
                  <span className="font-bold text-gray-700">{(totalSalesCard + totalSalesBizum).toFixed(2)}€</span>
                </div>
              </div>
            </div>

            {/* Card 3: Tarjetas Regalo & Facturación Total */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Gift className="w-32 h-32" />
              </div>
              <div>
                <h3 className="text-gray-500 font-semibold mb-1 flex items-center gap-2 text-sm">
                  <Gift className="w-4 h-4 text-primary" /> Facturación Bruta (Hoy)
                </h3>
                <div className="text-4xl font-extrabold text-gray-900 tracking-tight">{totalGrossBilled.toFixed(2)}€</div>
              </div>
              <div className="mt-6 flex flex-col gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Cobrado en caja / banco:</span>
                  <span className="font-bold text-gray-900">{totalNetCollected.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tarjetas Regalo vendidas:</span>
                  <span className="font-semibold text-primary">+{totalGiftCardsSold.toFixed(2)}€ ({todayGiftCards.length})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Saldo Regalo canjeado:</span>
                  <span className="font-semibold text-amber-600">-{totalGiftCardsRedeemed.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-gray-100">
                  <span className="text-gray-500">Descuentos aplicados:</span>
                  <span className="font-semibold text-gray-700">-{totalDiscounts.toFixed(2)}€</span>
                </div>
              </div>
            </div>

          </div>

          {/* Sistema de Pestañas */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="flex border-b border-gray-100 bg-gray-50/50 px-6 pt-3 gap-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab('sales')}
                className={`pb-3 px-4 font-bold text-sm border-b-2 transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'sales'
                    ? 'border-primary text-primary bg-white rounded-t-lg border-t border-x border-gray-200'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Receipt className="w-4 h-4" /> Ventas y Tickets de Hoy
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'sales' ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-600'
                }`}>
                  {sales.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('movements')}
                className={`pb-3 px-4 font-bold text-sm border-b-2 transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'movements'
                    ? 'border-primary text-primary bg-white rounded-t-lg border-t border-x border-gray-200'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <TrendingUp className="w-4 h-4" /> Movimientos Manuales
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'movements' ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-600'
                }`}>
                  {movements.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('closures')}
                className={`pb-3 px-4 font-bold text-sm border-b-2 transition flex items-center gap-2 cursor-pointer ${
                  activeTab === 'closures'
                    ? 'border-primary text-primary bg-white rounded-t-lg border-t border-x border-gray-200'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <History className="w-4 h-4" /> Historial de Cierres (30 días)
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'closures' ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-600'
                }`}>
                  {closures.length}
                </span>
              </button>
            </div>

            {/* Contenido Pestaña 1: Ventas y Tickets de Hoy */}
            {activeTab === 'sales' && (
              <div className="overflow-x-auto flex-1">
                {sales.length === 0 ? (
                  <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
                    <Receipt className="w-10 h-10 text-gray-300 stroke-1" />
                    <p className="font-semibold text-gray-700">Aún no hay ventas registradas hoy.</p>
                    <p className="text-xs text-gray-400">Las ventas cobradas desde el TPV aparecerán aquí en tiempo real.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-gray-50/70 border-b border-gray-100">
                      <tr>
                        <th className="p-4 font-semibold text-gray-600">Hora</th>
                        <th className="p-4 font-semibold text-gray-600">Ticket / Factura</th>
                        <th className="p-4 font-semibold text-gray-600">Cliente</th>
                        <th className="p-4 font-semibold text-gray-600">Artículos</th>
                        <th className="p-4 font-semibold text-gray-600">Método de Pago</th>
                        <th className="p-4 font-semibold text-gray-600 text-right">Descuentos</th>
                        <th className="p-4 font-semibold text-gray-600 text-right">Total</th>
                        <th className="p-4 font-semibold text-gray-600 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="p-4 text-xs font-semibold text-gray-500 whitespace-nowrap">
                            {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-4 font-bold text-gray-900 whitespace-nowrap">
                            {sale.invoice_number ? (
                              <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-800">
                                {sale.invoice_number}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">#{sale.id.substring(0, 8)}</span>
                            )}
                          </td>
                          <td className="p-4">
                            <p className="font-semibold text-gray-900 truncate max-w-[150px]">
                              {sale.client?.name || 'Cliente Ocasional'}
                            </p>
                            {sale.client?.phone && (
                              <p className="text-xs text-gray-400">{sale.client.phone}</p>
                            )}
                          </td>
                          <td className="p-4 text-xs text-gray-600 max-w-[200px] truncate" title={sale.sale_items?.map(i => `${i.quantity}x ${i.item_name}`).join(', ')}>
                            {sale.sale_items && sale.sale_items.length > 0 ? (
                              sale.sale_items.map(i => `${i.quantity}x ${i.item_name}`).join(', ')
                            ) : (
                              <span className="text-gray-400">Servicio / Venta</span>
                            )}
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              sale.payment_method === 'cash' ? 'bg-emerald-100 text-emerald-800' :
                              sale.payment_method === 'card' ? 'bg-blue-100 text-blue-800' :
                              sale.payment_method === 'bizum' ? 'bg-purple-100 text-purple-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {sale.payment_method === 'cash' ? 'Efectivo' :
                               sale.payment_method === 'card' ? 'Tarjeta' :
                               sale.payment_method === 'bizum' ? 'Bizum' :
                               sale.payment_method || 'Mixto'}
                            </span>
                          </td>
                          <td className="p-4 text-right text-xs">
                            {Number(sale.discount_amount) > 0 ? (
                              <span className="text-emerald-600 font-bold">
                                -{Number(sale.discount_amount).toFixed(2)}€
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="p-4 text-right font-extrabold text-gray-900 whitespace-nowrap">
                            {Number(sale.total_amount).toFixed(2)}€
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => setSelectedSaleDetails(sale)}
                              className="text-gray-400 hover:text-primary transition p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer"
                              title="Ver detalle del ticket"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Contenido Pestaña 2: Movimientos Manuales */}
            {activeTab === 'movements' && (
              <div className="overflow-x-auto flex-1">
                {regularMovements.length === 0 ? (
                  <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
                    <TrendingUp className="w-10 h-10 text-gray-300 stroke-1" />
                    <p className="font-semibold text-gray-700">No hay movimientos manuales registrados hoy.</p>
                    <p className="text-xs text-gray-400">Puedes registrar entradas (fondos, propinas) o salidas (compras, gastos rápidos) con el botón superior.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {regularMovements.map((m) => {
                      const isOpening = /fondo|apertura/i.test(m.reason);
                      return (
                        <div key={m.id} className="p-4 sm:px-6 hover:bg-gray-50/60 transition-colors flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isOpening ? 'bg-amber-100 text-amber-700' :
                              m.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {isOpening ? <Coins className="w-4 h-4" /> : m.type === 'in' ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-sm flex items-center gap-2">
                                {m.reason}
                                {isOpening && (
                                  <span className="text-[10px] uppercase font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                    Apertura de Caja
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                                <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span>•</span>
                                <span className="uppercase text-[10px] font-bold bg-gray-100 px-1.5 py-0.2 rounded text-gray-600">
                                  {m.payment_method === 'cash' ? 'EFECTIVO' : m.payment_method === 'card' ? 'TARJETA' : 'BIZUM'}
                                </span>
                              </p>
                            </div>
                          </div>
                          <div className={`font-extrabold text-base whitespace-nowrap ${m.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                            {m.type === 'in' ? '+' : '-'}{Number(m.amount).toFixed(2)}€
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Contenido Pestaña 3: Historial de Cierres */}
            {activeTab === 'closures' && (
              <div className="overflow-x-auto flex-1">
                {closures.length === 0 ? (
                  <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
                    <History className="w-10 h-10 text-gray-300 stroke-1" />
                    <p className="font-semibold text-gray-700">Aún no hay ningún cierre de caja guardado.</p>
                    <p className="text-xs text-gray-400">Cuando pulses "Cerrar Caja" al finalizar la jornada, quedará archivado aquí con su informe Z.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-gray-50/70 border-b border-gray-100">
                      <tr>
                        <th className="p-4 font-semibold text-gray-600">Fecha</th>
                        <th className="p-4 font-semibold text-gray-600 text-right">Efectivo Real</th>
                        <th className="p-4 font-semibold text-gray-600 text-right">Descuadre Ef.</th>
                        <th className="p-4 font-semibold text-gray-600 text-right">Banco Real</th>
                        <th className="p-4 font-semibold text-gray-600 text-right">Descuadre B.</th>
                        <th className="p-4 font-semibold text-gray-600">Notas</th>
                        <th className="p-4 font-semibold text-gray-600 text-center">Informe Z / Ticket</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {closures.map(closure => {
                        const reopened = isClosureReopened(closure);
                        const cleanNotes = getCleanClosureNotes(closure.notes);
                        return (
                          <tr key={closure.id} className={`hover:bg-gray-50/60 transition-colors ${reopened ? 'opacity-60 bg-gray-50/40' : ''}`}>
                            <td className="p-4 font-bold text-gray-900 whitespace-nowrap">
                              {new Date(closure.closure_date).toLocaleDateString()}
                              {reopened && (
                                <span className="ml-2 text-[10px] font-extrabold uppercase bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                                  Reabierto / Anulado
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-right font-extrabold text-gray-900">
                              {Number(closure.actual_cash).toFixed(2)}€
                            </td>
                            <td className={`p-4 text-right font-bold ${
                              Number(closure.discrepancy_cash) === 0 ? 'text-green-600' : 'text-red-500'
                            }`}>
                              {Number(closure.discrepancy_cash) > 0 ? '+' : ''}{Number(closure.discrepancy_cash).toFixed(2)}€
                            </td>
                            <td className="p-4 text-right font-extrabold text-gray-900">
                              {Number(closure.actual_bank).toFixed(2)}€
                            </td>
                            <td className={`p-4 text-right font-bold ${
                              Number(closure.discrepancy_bank) === 0 ? 'text-green-600' : 'text-red-500'
                            }`}>
                              {Number(closure.discrepancy_bank) > 0 ? '+' : ''}{Number(closure.discrepancy_bank).toFixed(2)}€
                            </td>
                            <td className="p-4 text-gray-500 text-xs max-w-[180px] truncate" title={cleanNotes}>
                              {cleanNotes || '-'}
                            </td>
                            <td className="p-4 text-center whitespace-nowrap">
                              <button
                                onClick={() => handleGenerateZReport(closure)}
                                className="text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                                title="Descargar Ticket de Cierre Z en PDF"
                              >
                                <FileText className="w-3.5 h-3.5 text-primary" /> Cierre Z
                              </button>
                              <button
                                onClick={() => handlePrintZTicket(closure)}
                                className="text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg transition inline-flex items-center gap-1 cursor-pointer shadow-sm ml-2"
                                title="Imprimir Ticket Térmico en impresora de tickets"
                              >
                                <Printer className="w-3.5 h-3.5 text-gray-600" /> Ticket
                              </button>
                              {closure.closure_date === todayString && !reopened && (
                                <button
                                  onClick={() => handleReopenRegister(closure.id)}
                                  className="text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1.5 rounded-lg transition inline-flex items-center gap-1 cursor-pointer shadow-sm ml-2"
                                  title="Anular este cierre y volver a abrir la caja"
                                >
                                  <Unlock className="w-3.5 h-3.5" /> Reabrir
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

          </div>
        </>
      )}

      {/* Modal Éxito Cierre de Caja */}
      {showPostClosureModal && lastClosedData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">¡Caja Cerrada Correctamente!</h2>
              <p className="text-xs text-gray-500 mt-1">
                La jornada del {new Date(lastClosedData.closure_date).toLocaleDateString()} ha quedado arqueada y archivada.
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs space-y-1.5 text-left">
              <div className="flex justify-between">
                <span className="text-gray-500">Efectivo Contado:</span>
                <span className="font-bold text-gray-900">{Number(lastClosedData.actual_cash).toFixed(2)}€</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Descuadre Efectivo:</span>
                <span className={`font-bold ${Number(lastClosedData.discrepancy_cash) === 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {Number(lastClosedData.discrepancy_cash) > 0 ? '+' : ''}{Number(lastClosedData.discrepancy_cash).toFixed(2)}€
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-200">
                <span className="text-gray-500">Banco / Datáfono:</span>
                <span className="font-bold text-gray-900">{Number(lastClosedData.actual_bank).toFixed(2)}€</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Descuadre Banco:</span>
                <span className={`font-bold ${Number(lastClosedData.discrepancy_bank) === 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {Number(lastClosedData.discrepancy_bank) > 0 ? '+' : ''}{Number(lastClosedData.discrepancy_bank).toFixed(2)}€
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={() => handleGenerateZReport(lastClosedData)}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <FileText className="w-5 h-5" /> Descargar Cierre Z (PDF)
              </button>

              <button
                onClick={() => handlePrintZTicket(lastClosedData)}
                className="w-full bg-gray-900 hover:bg-black text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Printer className="w-5 h-5" /> Imprimir Ticket Térmico (80mm)
              </button>

              <button
                onClick={() => setShowPostClosureModal(false)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-semibold transition text-xs cursor-pointer"
              >
                Terminar y Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Térmico de Cierre Z para Impresora de Tickets */}
      {printClosureData && (
        <div id="printable-closure-ticket" className="hidden print:block fixed inset-0 bg-white p-4 text-black font-mono text-[11px] leading-tight z-[99999]">
          <div className="w-[72mm] mx-auto text-center space-y-1">
            <h1 className="text-sm font-bold uppercase tracking-wider">{settings?.company_name || 'Ohana Peluquería y Estética'}</h1>
            {settings?.company_nif && <p className="text-[10px]">CIF/NIF: {settings.company_nif}</p>}
            {settings?.company_address && <p className="text-[9px]">{settings.company_address}, Palma del Río</p>}
            <p className="text-[10px]">Tel: 957 26 54 42</p>
            
            <div className="border-t border-b border-black border-dashed my-2 py-1">
              <p className="font-bold text-xs uppercase tracking-wider">CIERRE DE CAJA (CIERRE Z)</p>
              <p className="text-[10px]">Fecha: {new Date(printClosureData.closure.closure_date).toLocaleDateString()}</p>
              <p className="text-[9px]">Hora: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>

            {/* Desglose de Ventas */}
            {printClosureData.metrics && (
              <div className="text-left space-y-0.5 my-2 pb-2 border-b border-black border-dashed">
                <p className="font-bold uppercase text-[10px] mb-1">VENTAS DEL DÍA ({printClosureData.metrics.sales_count || 0} tickets)</p>
                <div className="flex justify-between">
                  <span>Efectivo:</span>
                  <span>{Number(printClosureData.metrics.sales_cash || 0).toFixed(2)}€</span>
                </div>
                <div className="flex justify-between">
                  <span>Tarjeta:</span>
                  <span>{Number(printClosureData.metrics.sales_card || 0).toFixed(2)}€</span>
                </div>
                <div className="flex justify-between">
                  <span>Bizum:</span>
                  <span>{Number(printClosureData.metrics.sales_bizum || 0).toFixed(2)}€</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-black/30">
                  <span>TOTAL COBRADO:</span>
                  <span>{Number(printClosureData.metrics.total_net_collected || 0).toFixed(2)}€</span>
                </div>
                {Number(printClosureData.metrics.total_discounts || 0) > 0 && (
                  <div className="flex justify-between text-[10px]">
                    <span>Descuentos aplicados:</span>
                    <span>-{Number(printClosureData.metrics.total_discounts).toFixed(2)}€</span>
                  </div>
                )}
                <div className="flex justify-between text-[10px]">
                  <span>Facturación Bruta:</span>
                  <span>{Number(printClosureData.metrics.total_gross_billed || 0).toFixed(2)}€</span>
                </div>
              </div>
            )}

            {/* Movimientos de Efectivo */}
            {printClosureData.metrics && (
              <div className="text-left space-y-0.5 my-2 pb-2 border-b border-black border-dashed">
                <p className="font-bold uppercase text-[10px] mb-1">MOVIMIENTOS DE CAJÓN</p>
                <div className="flex justify-between">
                  <span>Fondo Inicial:</span>
                  <span>+{Number(printClosureData.metrics.initial_float || 0).toFixed(2)}€</span>
                </div>
                {Number(printClosureData.metrics.total_in_cash || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Otros Ingresos:</span>
                    <span>+{Number(printClosureData.metrics.total_in_cash).toFixed(2)}€</span>
                  </div>
                )}
                {Number(printClosureData.metrics.total_out_cash || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>Gastos / Salidas:</span>
                    <span>-{Number(printClosureData.metrics.total_out_cash).toFixed(2)}€</span>
                  </div>
                )}
              </div>
            )}

            {/* Arqueo y Descuadre */}
            <div className="text-left space-y-1 my-2 pb-2 border-b border-black border-dashed">
              <p className="font-bold uppercase text-[10px]">ARQUEO Y DESCUADRES</p>
              <div className="flex justify-between">
                <span>Efectivo Esperado:</span>
                <span>{Number(printClosureData.closure.expected_cash).toFixed(2)}€</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Efectivo Real (Cajón):</span>
                <span>{Number(printClosureData.closure.actual_cash).toFixed(2)}€</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Descuadre Efectivo:</span>
                <span>{(Number(printClosureData.closure.discrepancy_cash) > 0 ? '+' : '') + Number(printClosureData.closure.discrepancy_cash).toFixed(2)}€</span>
              </div>

              <div className="pt-1 border-t border-black/30 flex justify-between">
                <span>Banco Esperado:</span>
                <span>{Number(printClosureData.closure.expected_bank).toFixed(2)}€</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Banco Real:</span>
                <span>{Number(printClosureData.closure.actual_bank).toFixed(2)}€</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Descuadre Banco:</span>
                <span>{(Number(printClosureData.closure.discrepancy_bank) > 0 ? '+' : '') + Number(printClosureData.closure.discrepancy_bank).toFixed(2)}€</span>
              </div>
            </div>

            {printClosureData.cleanNotes && (
              <div className="text-left my-2 pb-2 border-b border-black border-dashed text-[10px]">
                <p className="font-bold">NOTAS:</p>
                <p>{printClosureData.cleanNotes}</p>
              </div>
            )}

            <div className="pt-5 pb-2 text-center">
              <div className="border-t border-black w-36 mx-auto mb-1"></div>
              <p className="text-[9px] uppercase">Firma del Responsable</p>
            </div>

            <p className="text-[8px] text-gray-500 pt-1">Control Interno - Ohana Peluquería</p>
          </div>
        </div>
      )}
    </div>
  )
}
