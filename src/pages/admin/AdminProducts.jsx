import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  Plus, Trash2, Package, ClipboardList, CheckCircle, AlertTriangle,
  Edit3, Search, Truck, Phone, Mail, FileText, Share2,
  ArrowDownRight, ArrowUpRight, ShoppingCart, X, Sparkles, Clock, Receipt
} from 'lucide-react'
import { cn } from '../../lib/utils'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function AdminProducts() {
  const [activeTab, setActiveTab] = useState('catalog') // 'catalog' | 'movements' | 'orders' | 'suppliers'

  // Data states
  const [products, setProducts] = useState([])
  const [movements, setMovements] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [stockFilter, setStockFilter] = useState('all') // 'all' | 'low' | 'out' | 'optimal'
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [movementTypeFilter, setMovementTypeFilter] = useState('all') // 'all' | 'in' | 'out'

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false)
  const [isConsumptionModalOpen, setIsConsumptionModalOpen] = useState(false)
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)

  // Editing states
  const [editingProduct, setEditingProduct] = useState(null)
  const [editingSupplier, setEditingSupplier] = useState(null)

  // Form states
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: 0,
    cost_price: 0,
    stock: 0,
    min_stock_level: 5,
    category: '',
    supplier: '',
    barcode: ''
  })

  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    notes: ''
  })

  // Restock (Entrada de Albarán)
  const [restockReason, setRestockReason] = useState('Albarán Proveedor')
  const [restockSupplier, setRestockSupplier] = useState('')
  const [restockCart, setRestockCart] = useState([]) // { product_id, name, quantity, current_stock, cost_price }

  // Internal Consumption (Salida / Consumo Interno / Merma)
  const [consumptionReason, setConsumptionReason] = useState('Consumo Interno (Lavacabezas / Salón)')
  const [consumptionNotes, setConsumptionNotes] = useState('')
  const [consumptionCart, setConsumptionCart] = useState([]) // { product_id, name, quantity, current_stock }

  // Purchase Order (Pedido a Proveedor) y Recepción
  const [orderSupplier, setOrderSupplier] = useState('all')
  const [orderCart, setOrderCart] = useState([]) // { product_id, name, supplier, stock, min_stock_level, quantity, cost_price }
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [ordersSubTab, setOrdersSubTab] = useState('history') // 'history' | 'generator'
  const [orderFilterStatus, setOrderFilterStatus] = useState('all') // 'all' | 'pending' | 'received' | 'cancelled'
  const [orderSearchQuery, setOrderSearchQuery] = useState('')
  const [linkedOrderId, setLinkedOrderId] = useState(null)
  const [createInvoiceOnRestock, setCreateInvoiceOnRestock] = useState(false)
  const [restockPaymentMethod, setRestockPaymentMethod] = useState('direct_debit')
  const [restockPaymentDays, setRestockPaymentDays] = useState('0')
  const [invoices, setInvoices] = useState([])

  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      // 1. Obtener productos
      const { data: prodData } = await supabase.from('products').select('*').order('name')
      if (prodData) setProducts(prodData)

      // 2. Obtener movimientos de stock con items
      const { data: movData } = await supabase
        .from('stock_movements')
        .select(`
          *,
          stock_movement_items (
            quantity,
            product:products(name, price, cost_price, supplier)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(60)

      if (movData) setMovements(movData)

      // 3. Obtener proveedores (tolerante si la tabla aún no existe)
      try {
        const { data: suppData } = await supabase.from('suppliers').select('*').order('name')
        if (suppData) setSuppliers(suppData)
      } catch {
        // Tabla de proveedores pendiente de crear en Supabase
      }

      // 4. Configuración del negocio
      const { data: settData } = await supabase.from('settings').select('*').eq('id', 1).single()
      if (settData) setSettings(settData)

      // 5. Cargar pedidos a proveedores
      try {
        const { data: poData, error: poErr } = await supabase
          .from('purchase_orders')
          .select('*')
          .order('created_at', { ascending: false })
        if (!poErr && poData) {
          setPurchaseOrders(poData)
        } else {
          const local = localStorage.getItem('ohana_purchase_orders')
          setPurchaseOrders(local ? JSON.parse(local) : [])
        }
      } catch {
        const local = localStorage.getItem('ohana_purchase_orders')
        setPurchaseOrders(local ? JSON.parse(local) : [])
      }

      // 6. Cargar facturas de proveedores para verificar albaranes facturados
      try {
        const { data: invData } = await supabase.from('supplier_invoices').select('id, invoice_number, albaran_number')
        if (invData) {
          const local = localStorage.getItem('ohana_supplier_invoices')
          let localInvs = []
          try { localInvs = local ? JSON.parse(local) : [] } catch {}
          const combined = [...invData]
          localInvs.forEach(l => {
            if (!combined.some(c => c.id === l.id)) combined.push(l)
          })
          setInvoices(combined)
        } else {
          const local = localStorage.getItem('ohana_supplier_invoices')
          setInvoices(local ? JSON.parse(local) : [])
        }
      } catch {
        const local = localStorage.getItem('ohana_supplier_invoices')
        setInvoices(local ? JSON.parse(local) : [])
      }

    } catch (error) {
      console.error('Error cargando inventario:', error)
    } finally {
      setLoading(false)
    }
  }

  // Categorías y Proveedores únicos para filtros
  const uniqueCategories = useMemo(() => {
    const cats = new Set()
    products.forEach(p => {
      if (p.category) cats.add(p.category)
    })
    return Array.from(cats).sort()
  }, [products])

  const uniqueSuppliers = useMemo(() => {
    const supps = new Set()
    // De tabla suppliers
    suppliers.forEach(s => supps.add(s.name))
    // De productos
    products.forEach(p => {
      if (p.supplier) supps.add(p.supplier)
    })
    return Array.from(supps).sort()
  }, [products, suppliers])

  // Filtrado de productos en catálogo
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const minLevel = p.min_stock_level ?? 5
      // Búsqueda
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.supplier && p.supplier.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))

      // Filtro de Stock
      let matchesStock = true
      if (stockFilter === 'low') {
        matchesStock = p.stock > 0 && p.stock <= minLevel
      } else if (stockFilter === 'out') {
        matchesStock = p.stock <= 0
      } else if (stockFilter === 'optimal') {
        matchesStock = p.stock > minLevel
      }

      // Filtro de Categoría
      const matchesCat = categoryFilter === 'all' || p.category === categoryFilter

      // Filtro de Proveedor
      const matchesSupp = supplierFilter === 'all' || p.supplier === supplierFilter

      return matchesSearch && matchesStock && matchesCat && matchesSupp
    })
  }, [products, searchQuery, stockFilter, categoryFilter, supplierFilter])

  // Filtrado de movimientos
  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      if (movementTypeFilter === 'all') return true
      return m.type === movementTypeFilter
    })
  }, [movements, movementTypeFilter])

  // Productos que necesitan reposición urgente (stock <= min)
  const lowStockProducts = useMemo(() => {
    return products.filter(p => p.stock <= (p.min_stock_level ?? 5))
  }, [products])

  // Pedidos pendientes de recibir
  const pendingOrdersCount = useMemo(() => {
    return purchaseOrders.filter(o => o.status === 'pending').length
  }, [purchaseOrders])

  // Pedidos filtrados
  const filteredPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter(o => {
      const q = orderSearchQuery.toLowerCase().trim()
      const matchesSearch = !q ||
        (o.order_number && o.order_number.toLowerCase().includes(q)) ||
        (o.supplier_name && o.supplier_name.toLowerCase().includes(q)) ||
        (o.notes && o.notes.toLowerCase().includes(q))

      const matchesStatus = orderFilterStatus === 'all' || o.status === orderFilterStatus
      return matchesSearch && matchesStatus
    })
  }, [purchaseOrders, orderSearchQuery, orderFilterStatus])

  // --- CATALOG ACTIONS ---
  async function handleProductSubmit(e) {
    e.preventDefault()
    setIsProcessing(true)

    // Estructurar payload
    const basePayload = {
      name: productForm.name,
      description: productForm.description || '',
      price: parseFloat(productForm.price) || 0,
      stock: parseInt(productForm.stock) || 0,
      min_stock_level: parseInt(productForm.min_stock_level) ?? 5
    }

    const extendedPayload = {
      ...basePayload,
      cost_price: parseFloat(productForm.cost_price) || 0,
      category: productForm.category || null,
      supplier: productForm.supplier || null,
      barcode: productForm.barcode || null
    }

    try {
      let error = null
      if (editingProduct) {
        // Intentar con campos ampliados
        const res = await supabase.from('products').update(extendedPayload).eq('id', editingProduct)
        if (res.error) {
          // Si fallan columnas nuevas, fallback a base
          const fallbackRes = await supabase.from('products').update(basePayload).eq('id', editingProduct)
          error = fallbackRes.error
        }
      } else {
        const res = await supabase.from('products').insert([extendedPayload])
        if (res.error) {
          const fallbackRes = await supabase.from('products').insert([basePayload])
          error = fallbackRes.error
        }
      }

      if (error) throw error

      setIsProductModalOpen(false)
      setEditingProduct(null)
      setProductForm({
        name: '', description: '', price: 0, cost_price: 0,
        stock: 0, min_stock_level: 5, category: '', supplier: '', barcode: ''
      })
      await fetchData()
    } catch (err) {
      console.error('Error guardando producto:', err)
      alert('Error al guardar el producto: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  function openEditProductModal(prod) {
    setEditingProduct(prod.id)
    setProductForm({
      name: prod.name || '',
      description: prod.description || '',
      price: prod.price || 0,
      cost_price: prod.cost_price || 0,
      stock: prod.stock || 0,
      min_stock_level: prod.min_stock_level ?? 5,
      category: prod.category || '',
      supplier: prod.supplier || '',
      barcode: prod.barcode || ''
    })
    setIsProductModalOpen(true)
  }

  async function handleDeleteProduct(id) {
    if (!window.confirm('¿Estás seguro de eliminar este producto del catálogo?')) return
    try {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error
      await fetchData()
    } catch (err) {
      console.error('Error eliminando producto:', err)
      alert('Error al eliminar producto')
    }
  }

  // --- RESTOCK (ENTRADAS DE ALBARÁN) ---
  const addProductToRestock = (productId) => {
    if (!productId) return
    const prod = products.find(p => p.id === productId)
    if (!prod) return

    setRestockCart(prev => {
      const existing = prev.find(item => item.product_id === prod.id)
      if (existing) {
        return prev.map(item => item.product_id === prod.id ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, {
        product_id: prod.id,
        name: prod.name,
        quantity: 1,
        current_stock: prod.stock,
        cost_price: prod.cost_price || 0
      }]
    })
  }

  async function handleRestockSubmit() {
    if (restockCart.length === 0) return alert('No hay productos en el albarán')
    setIsProcessing(true)

    try {
      // 1. Generar número de albarán
      const { data: lastAlbaran } = await supabase
        .from('stock_movements')
        .select('albaran_number')
        .not('albaran_number', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      let nextNum = 1
      const currentYear2Digits = new Date().getFullYear().toString().slice(-2)

      if (lastAlbaran && lastAlbaran.albaran_number) {
        const parts = lastAlbaran.albaran_number.split('-')
        if (parts.length === 2 && parts[0] === `ALB${currentYear2Digits}`) {
          nextNum = parseInt(parts[1], 10) + 1
        }
      }

      const albaran_number = `ALB${currentYear2Digits}-${nextNum.toString().padStart(5, '0')}`
      const fullReason = restockSupplier ? `${restockReason} (${restockSupplier})` : restockReason

      // 2. Insertar movimiento de entrada
      const { data: movData, error: movError } = await supabase
        .from('stock_movements')
        .insert([{ type: 'in', reason: fullReason, albaran_number }])
        .select()
        .single()

      if (movError) throw movError

      // 3. Insertar items
      const items = restockCart.map(item => ({
        movement_id: movData.id,
        product_id: item.product_id,
        quantity: item.quantity
      }))

      const { error: itemsError } = await supabase.from('stock_movement_items').insert(items)
      if (itemsError) throw itemsError

      // 4. Actualizar stock en products
      for (const item of restockCart) {
        const newStock = item.current_stock + item.quantity
        await supabase.from('products').update({ stock: newStock }).eq('id', item.product_id)
      }

      // 5. Si venía de un pedido vinculado, marcarlo como recibido
      if (linkedOrderId) {
        const matchingOrder = purchaseOrders.find(o => o.id === linkedOrderId)
        if (matchingOrder) {
          const updatedOrder = {
            ...matchingOrder,
            status: 'received',
            albaran_number,
            received_at: new Date().toISOString()
          }
          await savePurchaseOrder(updatedOrder, true)
          setPurchaseOrders(prev => prev.map(o => o.id === linkedOrderId ? updatedOrder : o))
        }
      }

      // 6. Si se marcó crear factura de compra asociada
      if (createInvoiceOnRestock) {
        const subtotal = restockCart.reduce((sum, item) => sum + ((parseFloat(item.cost_price) || 0) * item.quantity), 0)
        const tax = subtotal * 0.21
        const total = subtotal + tax
        const finalSupplier = (restockSupplier && restockSupplier.trim())
          || (linkedOrderId ? purchaseOrders.find(o => o.id === linkedOrderId)?.supplier_name : '')
          || 'Proveedor General'

        let due_date = null
        if (restockPaymentDays && restockPaymentDays !== '0') {
          const d = new Date()
          d.setDate(d.getDate() + parseInt(restockPaymentDays, 10))
          due_date = d.toISOString().split('T')[0]
        }

        const invoiceData = {
          id: crypto.randomUUID(),
          invoice_number: `FAC-${albaran_number}`,
          supplier_name: finalSupplier,
          category: 'Productos y Cosmética (Inventario)',
          invoice_date: new Date().toISOString().split('T')[0],
          due_date: due_date,
          base_amount: subtotal,
          tax_rate: 21,
          tax_amount: tax,
          irpf_rate: 0,
          irpf_amount: 0,
          total_amount: total,
          payment_method: restockPaymentMethod || 'direct_debit',
          payment_status: 'pending',
          albaran_number,
          order_id: linkedOrderId || null,
          notes: `Generada automáticamente al recepcionar albarán ${albaran_number}${restockPaymentDays !== '0' ? ` (Aplazado ${restockPaymentDays} días)` : ''}`,
          created_at: new Date().toISOString()
        }

        try {
          const { error: invErr } = await supabase.from('supplier_invoices').insert([invoiceData])
          if (invErr) throw invErr
        } catch (errInv) {
          console.warn('Fallback local para factura:', errInv)
          const local = localStorage.getItem('ohana_supplier_invoices')
          const curr = local ? JSON.parse(local) : []
          localStorage.setItem('ohana_supplier_invoices', JSON.stringify([invoiceData, ...curr]))
        }
      }

      setIsRestockModalOpen(false)
      setRestockCart([])
      setRestockSupplier('')
      const wasLinked = !!linkedOrderId
      setLinkedOrderId(null)
      setCreateInvoiceOnRestock(false)
      await fetchData()
      alert(wasLinked
        ? `¡Albarán ${albaran_number} registrado y Pedido marcado como RECIBIDO!`
        : `¡Albarán ${albaran_number} registrado y stock actualizado con éxito!`
      )
    } catch (error) {
      console.error('Error procesando albarán:', error)
      alert('Error al registrar la entrada')
    } finally {
      setIsProcessing(false)
    }
  }

  // --- INTERNAL CONSUMPTION (SALIDA DE STOCK / USO INTERNO) ---
  const addProductToConsumption = (productId) => {
    if (!productId) return
    const prod = products.find(p => p.id === productId)
    if (!prod) return

    setConsumptionCart(prev => {
      const existing = prev.find(item => item.product_id === prod.id)
      if (existing) {
        if (existing.quantity >= prod.stock) {
          alert(`No puedes retirar más de ${prod.stock} unidades disponibles en stock.`)
          return prev
        }
        return prev.map(item => item.product_id === prod.id ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, {
        product_id: prod.id,
        name: prod.name,
        quantity: 1,
        current_stock: prod.stock
      }]
    })
  }

  async function handleConsumptionSubmit() {
    if (consumptionCart.length === 0) return alert('No hay productos seleccionados para la salida')
    setIsProcessing(true)

    try {
      const fullReason = consumptionNotes
        ? `${consumptionReason}: ${consumptionNotes}`
        : consumptionReason

      // 1. Insertar movimiento de salida
      const { data: movData, error: movError } = await supabase
        .from('stock_movements')
        .insert([{ type: 'out', reason: fullReason }])
        .select()
        .single()

      if (movError) throw movError

      // 2. Insertar items
      const items = consumptionCart.map(item => ({
        movement_id: movData.id,
        product_id: item.product_id,
        quantity: item.quantity
      }))

      const { error: itemsError } = await supabase.from('stock_movement_items').insert(items)
      if (itemsError) throw itemsError

      // 3. Descontar stock
      for (const item of consumptionCart) {
        const newStock = Math.max(0, item.current_stock - item.quantity)
        await supabase.from('products').update({ stock: newStock }).eq('id', item.product_id)
      }

      setIsConsumptionModalOpen(false)
      setConsumptionCart([])
      setConsumptionNotes('')
      await fetchData()
      alert('¡Salida de stock registrada y almacén actualizado correctamente!')
    } catch (err) {
      console.error('Error registrando salida:', err)
      alert('Error al registrar la salida de stock')
    } finally {
      setIsProcessing(false)
    }
  }

  // --- PURCHASE ORDERS (PEDIDOS A PROVEEDOR Y RECEPCIÓN) ---
  async function savePurchaseOrder(orderObj, isEdit = false) {
    try {
      if (isEdit) {
        const { error } = await supabase.from('purchase_orders').update(orderObj).eq('id', orderObj.id)
        if (error && error.code === 'PGRST205') throw error
      } else {
        const { error } = await supabase.from('purchase_orders').insert([orderObj])
        if (error && error.code === 'PGRST205') throw error
      }
    } catch {
      const local = localStorage.getItem('ohana_purchase_orders')
      const current = local ? JSON.parse(local) : []
      let updated
      if (isEdit) {
        updated = current.map(o => o.id === orderObj.id ? orderObj : o)
      } else {
        updated = [orderObj, ...current]
      }
      localStorage.setItem('ohana_purchase_orders', JSON.stringify(updated))
    }
  }

  function openOrderModal(supplierName = 'all') {
    setOrderSupplier(supplierName)
    // Inicializar productos bajo mínimo
    const itemsToOrder = lowStockProducts
      .filter(p => supplierName === 'all' || p.supplier === supplierName)
      .map(p => {
        const minLvl = p.min_stock_level ?? 5
        const suggestedQty = Math.max(minLvl, minLvl - p.stock)
        return {
          product_id: p.id,
          name: p.name,
          supplier: p.supplier || 'Sin Proveedor',
          stock: p.stock,
          min_stock_level: minLvl,
          quantity: suggestedQty,
          cost_price: p.cost_price || 0
        }
      })

    setOrderCart(itemsToOrder)
    setIsOrderModalOpen(true)
  }

  function openManualOrderModal(supplierName = '') {
    const initialSupp = supplierName || (suppliers[0]?.name || 'all')
    setOrderSupplier(initialSupp)
    setOrderCart([])
    setIsOrderModalOpen(true)
  }

  const addProductToOrder = (productId) => {
    if (!productId) return
    const prod = products.find(p => p.id === productId)
    if (!prod) return

    setOrderCart(prev => {
      const existing = prev.find(item => item.product_id === prod.id)
      if (existing) {
        return prev.map(item => item.product_id === prod.id ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, {
        product_id: prod.id,
        name: prod.name,
        supplier: prod.supplier || 'Sin Proveedor',
        stock: prod.stock,
        min_stock_level: prod.min_stock_level ?? 5,
        quantity: Math.max(1, prod.min_stock_level ?? 1),
        cost_price: prod.cost_price || 0
      }]
    })
  }

  async function handleEmitPurchaseOrder() {
    if (orderCart.length === 0) return alert('No hay productos en el pedido')
    setIsProcessing(true)
    try {
      const currentYear2Digits = new Date().getFullYear().toString().slice(-2)
      let nextNum = 1
      const existingThisYear = purchaseOrders.filter(o => o.order_number?.startsWith(`PED${currentYear2Digits}-`))
      if (existingThisYear.length > 0) {
        const maxNum = Math.max(...existingThisYear.map(o => {
          const parts = o.order_number.split('-')
          return parseInt(parts[1], 10) || 0
        }))
        nextNum = maxNum + 1
      }
      const order_number = `PED${currentYear2Digits}-${nextNum.toString().padStart(5, '0')}`
      const totalEstimated = orderCart.reduce((sum, item) => sum + ((parseFloat(item.cost_price) || 0) * item.quantity), 0)

      const newOrder = {
        id: crypto.randomUUID(),
        order_number,
        supplier_name: orderSupplier === 'all' ? 'Multimarcas / General' : orderSupplier,
        status: 'pending',
        items: orderCart,
        total_estimated: totalEstimated,
        notes: `Pedido reposición con ${orderCart.length} productos`,
        created_at: new Date().toISOString()
      }

      await savePurchaseOrder(newOrder, false)
      setPurchaseOrders(prev => [newOrder, ...prev])
      setIsOrderModalOpen(false)
      setOrdersSubTab('history')
      alert(`¡Pedido ${order_number} emitido y guardado como PENDIENTE DE RECEPCIÓN!`)
    } catch (err) {
      console.error(err)
      alert('Error guardando el pedido: ' + (err.message || 'Error desconocido'))
    } finally {
      setIsProcessing(false)
    }
  }

  function handleStartOrderReception(order) {
    setLinkedOrderId(order.id)
    setRestockSupplier(order.supplier_name || 'Multimarcas / General')
    setRestockReason(`Recepción Pedido ${order.order_number}`)
    setCreateInvoiceOnRestock(true)

    const itemsForRestock = order.items.map(item => {
      const currentProd = products.find(p => p.id === item.product_id)
      return {
        product_id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        current_stock: currentProd?.stock ?? item.stock ?? 0,
        cost_price: item.cost_price || 0
      }
    })
    setRestockCart(itemsForRestock)
    setIsRestockModalOpen(true)
  }

  async function handleCancelOrder(order) {
    if (!window.confirm(`¿Deseas cancelar el pedido ${order.order_number}?`)) return
    const updated = { ...order, status: 'cancelled' }
    await savePurchaseOrder(updated, true)
    setPurchaseOrders(prev => prev.map(o => o.id === order.id ? updated : o))
  }

  function handleSendOrderWhatsApp() {
    if (orderCart.length === 0) return alert('No hay productos en el pedido')

    const suppObj = suppliers.find(s => s.name === orderSupplier)
    const phone = suppObj?.phone ? suppObj.phone.replace(/[^0-9]/g, '') : ''

    const companyName = settings?.company_name || 'Ohana Peluquería y Estética'
    const today = new Date().toLocaleDateString()

    let text = `📦 *PEDIDO DE REPOSICIÓN DE PRODUCTOS*\n`
    text += `*Cliente:* ${companyName}\n`
    text += `*Fecha:* ${today}\n`
    if (orderSupplier !== 'all') text += `*Proveedor:* ${orderSupplier}\n`
    text += `\n*Productos solicitados:*\n`

    orderCart.forEach((item, idx) => {
      text += `${idx + 1}. *${item.quantity} uds* - ${item.name}\n`
    })

    text += `\nPor favor, confirmadnos la recepción del pedido y fecha de entrega. ¡Muchas gracias!`

    if (phone) {
      const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`
      window.open(url, '_blank')
    } else {
      // Si no tiene teléfono configurado, copiar al portapapeles
      navigator.clipboard.writeText(text)
      alert('¡Texto del pedido copiado al portapapeles! Puedes pegarlo directamente en WhatsApp al comercial.')
    }
  }

  function handleGenerateOrderPDF() {
    if (orderCart.length === 0) return alert('No hay productos en el pedido')

    const doc = new jsPDF()
    const company = settings?.company_name || 'Ohana Peluquería y Estética'
    const nif = settings?.company_nif || ''
    const address = settings?.company_address ? `${settings.company_address}, ${settings.company_city || ''}` : ''

    // Cabecera
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(company, 105, 20, { align: 'center' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    if (nif) doc.text(`CIF/NIF: ${nif}`, 105, 26, { align: 'center' })
    if (address) doc.text(address, 105, 31, { align: 'center' })

    doc.setLineWidth(0.4)
    doc.line(14, 35, 196, 35)

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('ORDEN DE COMPRA / PEDIDO A PROVEEDOR', 14, 44)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 52)
    doc.text(`Proveedor Destino: ${orderSupplier === 'all' ? 'Multimarcas / General' : orderSupplier}`, 14, 58)

    const tableData = orderCart.map((item, idx) => [
      idx + 1,
      item.name,
      item.supplier,
      `${item.quantity} uds`,
      item.cost_price ? `${Number(item.cost_price).toFixed(2)} €` : '-',
      item.cost_price ? `${(Number(item.cost_price) * item.quantity).toFixed(2)} €` : '-'
    ])

    const totalEst = orderCart.reduce((sum, i) => sum + (Number(i.cost_price || 0) * i.quantity), 0)

    autoTable(doc, {
      startY: 65,
      head: [['#', 'Producto', 'Marca/Proveedor', 'Cantidad Solicitada', 'Precio Coste Est.', 'Subtotal']],
      body: tableData,
      foot: totalEst > 0 ? [['', '', '', 'TOTAL ESTIMADO', '', `${totalEst.toFixed(2)} €`]] : undefined,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] }
    })

    const finalY = doc.lastAutoTable.finalY + 15
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text('Documento oficial de solicitud de mercancía - Ohana Gestión', 105, finalY + 15, { align: 'center' })

    doc.save(`Pedido_${orderSupplier}_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  // --- SUPPLIERS MANAGEMENT ---
  async function handleSupplierSubmit(e) {
    e.preventDefault()
    setIsProcessing(true)

    try {
      if (editingSupplier) {
        const { error } = await supabase.from('suppliers').update(supplierForm).eq('id', editingSupplier)
        if (error) throw error
      } else {
        const { error } = await supabase.from('suppliers').insert([supplierForm])
        if (error) throw error
      }

      setIsSupplierModalOpen(false)
      setEditingSupplier(null)
      setSupplierForm({ name: '', contact_person: '', phone: '', email: '', notes: '' })
      await fetchData()
      alert('¡Proveedor guardado con éxito!')
    } catch (err) {
      console.error('Error guardando proveedor:', err)
      alert('Error guardando proveedor. Asegúrate de haber ejecutado el script SQL de proveedores en Supabase.')
    } finally {
      setIsProcessing(false)
    }
  }

  async function handleDeleteSupplier(id) {
    if (!window.confirm('¿Deseas eliminar este proveedor?')) return
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id)
      if (error) throw error
      await fetchData()
    } catch (err) {
      console.error('Error eliminando proveedor:', err)
      alert('Error al eliminar proveedor')
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col gap-8 bg-gray-50/50 min-h-screen">

      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Package className="w-8 h-8 text-primary" /> Almacén e Inventario
          </h1>
          <p className="text-gray-500 mt-1">
            Control de stock, alertas de reposición, albaranes de entrada, consumo interno y proveedores.
          </p>
        </div>

        {/* TABS NAVEGACIÓN */}
        <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200 flex flex-wrap items-center gap-1">
          <button
            onClick={() => setActiveTab('catalog')}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'catalog' ? "bg-gray-900 text-white shadow-sm" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            <Package className="w-4 h-4" /> Catálogo ({products.length})
          </button>

          <button
            onClick={() => setActiveTab('movements')}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'movements' ? "bg-gray-900 text-white shadow-sm" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            <ClipboardList className="w-4 h-4" /> Movimientos y Albaranes
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer relative",
              activeTab === 'orders' ? "bg-gray-900 text-white shadow-sm" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            <ShoppingCart className="w-4 h-4" /> Pedidos Reposición
            {lowStockProducts.length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-extrabold animate-pulse">
                {lowStockProducts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('suppliers')}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'suppliers' ? "bg-gray-900 text-white shadow-sm" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            )}
          >
            <Truck className="w-4 h-4" /> Proveedores ({suppliers.length})
          </button>

          <Link
            to="/admin/expenses"
            className="px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          >
            <Receipt className="w-4 h-4 text-emerald-600" /> Facturas y Gastos
          </Link>
        </div>
      </div>

      {/* BANNER DE ALERTA DE STOCK MÍNIMO */}
      {lowStockProducts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 shadow-inner">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm flex items-center gap-2">
                ¡{lowStockProducts.length} {lowStockProducts.length === 1 ? 'producto necesita' : 'productos necesitan'} reposición urgente!
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Han bajado de su stock mínimo de seguridad. Puedes generar la lista de pedido con un solo clic.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => openOrderModal('all')}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" /> Generar Pedido de Reposición
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-gray-400 font-medium">Cargando inventario de Ohana...</div>
      ) : (
        <>
          {/* TAB 1: CATÁLOGO */}
          {activeTab === 'catalog' && (
            <div className="flex flex-col gap-6">

              {/* BARRA DE BÚSQUEDA Y ACCIONES */}
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Buscar producto por nombre, marca, categoría o código..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Filtros Rápidos */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={stockFilter}
                    onChange={e => setStockFilter(e.target.value)}
                    className="border border-gray-200 rounded-xl text-xs font-semibold px-3 py-2 bg-white text-gray-700"
                  >
                    <option value="all">📦 Estado: Todos</option>
                    <option value="optimal">✅ Stock Óptimo</option>
                    <option value="low">⚠️ Bajo Mínimo</option>
                    <option value="out">🛑 Agotado (0 uds)</option>
                  </select>

                  {uniqueCategories.length > 0 && (
                    <select
                      value={categoryFilter}
                      onChange={e => setCategoryFilter(e.target.value)}
                      className="border border-gray-200 rounded-xl text-xs font-semibold px-3 py-2 bg-white text-gray-700"
                    >
                      <option value="all">🏷️ Categoría: Todas</option>
                      {uniqueCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  )}

                  {uniqueSuppliers.length > 0 && (
                    <select
                      value={supplierFilter}
                      onChange={e => setSupplierFilter(e.target.value)}
                      className="border border-gray-200 rounded-xl text-xs font-semibold px-3 py-2 bg-white text-gray-700"
                    >
                      <option value="all">🚚 Proveedor: Todos</option>
                      {uniqueSuppliers.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  )}

                  <button
                    onClick={() => {
                      setEditingProduct(null)
                      setProductForm({
                        name: '', description: '', price: 0, cost_price: 0,
                        stock: 0, min_stock_level: 5, category: '', supplier: '', barcode: ''
                      })
                      setIsProductModalOpen(true)
                    }}
                    className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0 ml-auto"
                  >
                    <Plus className="w-4 h-4" /> Nuevo Producto
                  </button>
                </div>
              </div>

              {/* GRID DE PRODUCTOS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {filteredProducts.map(product => {
                  const minLevel = product.min_stock_level ?? 5
                  const isOut = product.stock <= 0
                  const isLow = product.stock > 0 && product.stock <= minLevel
                  const marginPct = product.price > 0 && product.cost_price > 0
                    ? Math.round(((product.price - product.cost_price) / product.price) * 100)
                    : null

                  return (
                    <div
                      key={product.id}
                      className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden group"
                    >
                      <div>
                        {/* Badges de Categoría y Stock */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 truncate max-w-[140px]">
                            {product.category || product.supplier || 'General'}
                          </span>

                          <span className={cn(
                            "text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0 flex items-center gap-1",
                            isOut ? "bg-red-100 text-red-700" :
                            isLow ? "bg-amber-100 text-amber-800" :
                            "bg-emerald-100 text-emerald-800"
                          )}>
                            {isOut ? 'Agotado' : isLow ? 'Bajo mínimo' : 'En stock'}
                          </span>
                        </div>

                        {/* Nombre y Descripción */}
                        <h3 className="font-bold text-gray-900 text-base leading-snug group-hover:text-primary transition-colors">
                          {product.name}
                        </h3>

                        {product.supplier && (
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                            <Truck className="w-3 h-3 text-gray-400" /> {product.supplier}
                          </p>
                        )}

                        {product.description && (
                          <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                            {product.description}
                          </p>
                        )}
                      </div>

                      {/* Métricas: Stock y Precios */}
                      <div className="mt-5 pt-4 border-t border-gray-100">
                        <div className="flex items-end justify-between">
                          <div>
                            <div className="text-2xl font-black text-gray-900">
                              {Number(product.price).toFixed(2)}€
                            </div>
                            {product.cost_price > 0 && (
                              <div className="text-[11px] text-gray-400">
                                Coste: {Number(product.cost_price).toFixed(2)}€ {marginPct !== null && `(${marginPct}% margen)`}
                              </div>
                            )}
                          </div>

                          <div className="text-right">
                            <div className={cn(
                              "text-lg font-black",
                              isOut ? "text-red-600" : isLow ? "text-amber-600" : "text-emerald-700"
                            )}>
                              {product.stock} <span className="text-xs font-normal text-gray-500">uds</span>
                            </div>
                            <div className="text-[10px] text-gray-400">
                              Mínimo: {minLevel} uds
                            </div>
                          </div>
                        </div>

                        {/* Botones de Acción */}
                        <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
                          <button
                            onClick={() => openEditProductModal(product)}
                            className="text-xs font-bold text-gray-600 hover:text-primary flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-gray-50 transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Editar
                          </button>

                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="text-xs font-bold text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer"
                            title="Eliminar producto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {filteredProducts.length === 0 && (
                  <div className="col-span-full py-16 text-center text-gray-400 bg-white rounded-2xl border border-gray-200 border-dashed">
                    <Package className="w-12 h-12 mx-auto text-gray-300 stroke-1 mb-2" />
                    <p className="font-semibold text-gray-700 text-sm">No se han encontrado productos con estos filtros.</p>
                    <p className="text-xs text-gray-400 mt-1">Prueba a borrar el texto de búsqueda o cambia los filtros de stock.</p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: MOVIMIENTOS Y ALBARANES */}
          {activeTab === 'movements' && (
            <div className="flex flex-col gap-6">

              {/* Botones de Acción para Almacén */}
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMovementTypeFilter('all')}
                    className={cn(
                      "px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition",
                      movementTypeFilter === 'all' ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    Todos ({movements.length})
                  </button>
                  <button
                    onClick={() => setMovementTypeFilter('in')}
                    className={cn(
                      "px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition",
                      movementTypeFilter === 'in' ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                    )}
                  >
                    🟢 Entradas (Albaranes)
                  </button>
                  <button
                    onClick={() => setMovementTypeFilter('out')}
                    className={cn(
                      "px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition",
                      movementTypeFilter === 'out' ? "bg-red-600 text-white" : "bg-red-50 text-red-800 hover:bg-red-100"
                    )}
                  >
                    🔴 Salidas (Consumo / Ventas)
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setConsumptionCart([])
                      setConsumptionReason('Consumo Interno (Lavacabezas / Salón)')
                      setIsConsumptionModalOpen(true)
                    }}
                    className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowDownRight className="w-4 h-4 text-red-500" /> Registrar Salida / Consumo
                  </button>

                  <button
                    onClick={() => {
                      setRestockCart([])
                      setRestockReason('Albarán Proveedor')
                      setRestockSupplier('')
                      setIsRestockModalOpen(true)
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowUpRight className="w-4 h-4" /> Registrar Entrada (Albarán)
                  </button>
                </div>
              </div>

              {/* TABLA DE MOVIMIENTOS */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {filteredMovements.length === 0 ? (
                  <div className="p-16 text-center text-gray-500">
                    <ClipboardList className="w-12 h-12 mx-auto text-gray-300 stroke-1 mb-2" />
                    <p className="font-semibold text-gray-700">No hay movimientos registrados para este filtro.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-gray-50/70 border-b border-gray-100">
                      <tr>
                        <th className="p-4 font-semibold text-gray-600">Tipo</th>
                        <th className="p-4 font-semibold text-gray-600">Referencia / Albarán</th>
                        <th className="p-4 font-semibold text-gray-600">Fecha y Hora</th>
                        <th className="p-4 font-semibold text-gray-600">Motivo / Observaciones</th>
                        <th className="p-4 font-semibold text-gray-600">Detalle de Productos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredMovements.map(mov => {
                        const isIn = mov.type === 'in'
                        return (
                          <tr key={mov.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="p-4 whitespace-nowrap">
                              <span className={cn(
                                "text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-full inline-flex items-center gap-1",
                                isIn ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                              )}>
                                {isIn ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                {isIn ? 'Entrada' : 'Salida'}
                              </span>
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-gray-900">{mov.albaran_number || '-'}</span>
                                {isIn && mov.albaran_number && (
                                  (() => {
                                    const matchingInvoice = invoices.find(inv => {
                                      if (!inv.albaran_number) return false
                                      const list = inv.albaran_number.split(',').map(s => s.trim().toUpperCase())
                                      return list.includes(mov.albaran_number.trim().toUpperCase())
                                    })
                                    if (matchingInvoice) {
                                      return (
                                        <span
                                          className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                                          title={`Facturado en ${matchingInvoice.invoice_number}`}
                                        >
                                          ✓ Facturado
                                        </span>
                                      )
                                    }
                                    return (
                                      <span
                                        className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                                        title="Albarán de entrega pendiente de facturar"
                                      >
                                        ⏳ Pendiente de Factura
                                      </span>
                                    )
                                  })()
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-gray-600 text-xs whitespace-nowrap">
                              {new Date(mov.created_at).toLocaleDateString()} {new Date(mov.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-4 font-medium text-gray-800">
                              {mov.reason}
                            </td>
                            <td className="p-4">
                              <ul className="space-y-1">
                                {mov.stock_movement_items && mov.stock_movement_items.map((item, idx) => (
                                  <li key={idx} className="text-xs text-gray-700 flex items-center gap-1.5">
                                    <span className={cn("font-bold px-1.5 py-0.2 rounded text-[11px]", isIn ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
                                      {isIn ? '+' : '-'}{item.quantity} uds
                                    </span>
                                    <span>{item.product?.name || 'Producto borrado'}</span>
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: GESTIÓN Y RECEPCIÓN DE PEDIDOS A PROVEEDOR */}
          {activeTab === 'orders' && (
            <div className="flex flex-col gap-6">

              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-primary" /> Gestión y Recepción de Pedidos a Proveedor
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Controla los pedidos enviados a tus comerciales y dales entrada en almacén con 1 solo clic al llegar el albarán.
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Selector de Subpestañas */}
                  <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button
                      onClick={() => setOrdersSubTab('history')}
                      className={cn(
                        "px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer",
                        ordersSubTab === 'history' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
                      )}
                    >
                      <Clock className="w-3.5 h-3.5" /> Pedidos Emitidos
                      {pendingOrdersCount > 0 && (
                        <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
                          {pendingOrdersCount}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => setOrdersSubTab('generator')}
                      className={cn(
                        "px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer",
                        ordersSubTab === 'generator' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
                      )}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Reposición Automática
                      {lowStockProducts.length > 0 && (
                        <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-extrabold animate-pulse">
                          {lowStockProducts.length}
                        </span>
                      )}
                    </button>
                  </div>

                  <button
                    onClick={() => openManualOrderModal()}
                    className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Nuevo Pedido Manual
                  </button>
                </div>
              </div>

              {/* VISTA A: HISTORIAL DE PEDIDOS EMITIDOS */}
              {ordersSubTab === 'history' && (
                <div className="space-y-4">
                  {/* Barra de filtros de pedidos */}
                  <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="relative w-full sm:w-80">
                      <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
                      <input
                        type="text"
                        value={orderSearchQuery}
                        onChange={e => setOrderSearchQuery(e.target.value)}
                        placeholder="Buscar por Nº pedido, proveedor..."
                        className="w-full border border-gray-200 pl-10 pr-3.5 py-2 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <select
                        value={orderFilterStatus}
                        onChange={e => setOrderFilterStatus(e.target.value)}
                        className="w-full sm:w-auto border border-gray-200 p-2 rounded-xl text-xs bg-white font-medium"
                      >
                        <option value="all">Todos los Estados ({purchaseOrders.length})</option>
                        <option value="pending">⏳ Solo Pendientes de Recibir ({pendingOrdersCount})</option>
                        <option value="received">✅ Solo Recibidos</option>
                        <option value="cancelled">Solo Cancelados</option>
                      </select>
                    </div>
                  </div>

                  {filteredPurchaseOrders.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center text-gray-500 shadow-sm">
                      <ShoppingCart className="w-12 h-12 mx-auto text-gray-300 stroke-1 mb-2" />
                      <p className="font-bold text-gray-800 text-base">No hay pedidos registrados con este filtro.</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Puedes preparar un pedido de reposición automática o crear uno manual con el botón superior.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {filteredPurchaseOrders.map(order => {
                        const isPending = order.status === 'pending'
                        const isReceived = order.status === 'received'
                        const isCancelled = order.status === 'cancelled'

                        return (
                          <div
                            key={order.id}
                            className={cn(
                              "bg-white rounded-2xl border p-5 shadow-sm flex flex-col justify-between transition-all",
                              isPending ? "border-amber-200 hover:border-amber-300 ring-1 ring-amber-100" : "border-gray-200"
                            )}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-3">
                                <div>
                                  <span className="font-mono font-bold text-gray-900 text-sm">{order.order_number}</span>
                                  <p className="text-[11px] text-gray-400 mt-0.5">
                                    {new Date(order.created_at).toLocaleDateString()}
                                  </p>
                                </div>

                                <span className={cn(
                                  "text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1",
                                  isPending && "bg-amber-100 text-amber-800",
                                  isReceived && "bg-emerald-100 text-emerald-800",
                                  isCancelled && "bg-gray-100 text-gray-600"
                                )}>
                                  {isPending && <Clock className="w-3 h-3" />}
                                  {isReceived && <CheckCircle className="w-3 h-3" />}
                                  {isPending ? 'Pendiente de Recibir' : isReceived ? `Recibido (${order.albaran_number || 'OK'})` : 'Cancelado'}
                                </span>
                              </div>

                              <div className="mb-3 pb-3 border-b border-gray-100">
                                <p className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                                  <Truck className="w-4 h-4 text-primary" /> {order.supplier_name}
                                </p>
                                {order.total_estimated > 0 && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Importe estimado: <strong className="text-gray-900 font-bold">{order.total_estimated.toFixed(2)}€</strong>
                                  </p>
                                )}
                              </div>

                              {/* Desglose de productos */}
                              <div className="space-y-1.5 mb-4 max-h-40 overflow-y-auto pr-1">
                                {order.items && order.items.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-gray-50/70">
                                    <span className="font-medium text-gray-800 truncate max-w-[180px]">{item.name}</span>
                                    <span className="font-bold text-primary shrink-0">{item.quantity} uds</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="pt-3 border-t border-gray-100 space-y-2">
                              {/* Botón Principal: Recepcionar Pedido */}
                              {isPending && (
                                <button
                                  onClick={() => handleStartOrderReception(order)}
                                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  <Truck className="w-4 h-4" /> Recepcionar Pedido (Crear Albarán)
                                </button>
                              )}

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setOrderSupplier(order.supplier_name)
                                    setOrderCart(order.items || [])
                                    handleGenerateOrderPDF()
                                  }}
                                  className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-[11px] py-1.5 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                                  title="Descargar orden de compra"
                                >
                                  <FileText className="w-3.5 h-3.5 text-primary" /> PDF
                                </button>

                                <button
                                  onClick={() => {
                                    setOrderSupplier(order.supplier_name)
                                    setOrderCart(order.items || [])
                                    handleSendOrderWhatsApp()
                                  }}
                                  className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-[11px] py-1.5 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                                  title="Reenviar por WhatsApp"
                                >
                                  <Share2 className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp
                                </button>

                                {isPending && (
                                  <button
                                    onClick={() => handleCancelOrder(order)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition cursor-pointer"
                                    title="Cancelar pedido"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* VISTA B: GENERADOR INTELIGENTE DE REPOSICIÓN */}
              {ordersSubTab === 'generator' && (
                <div>
                  {lowStockProducts.length === 0 ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-12 text-center text-emerald-800">
                      <CheckCircle className="w-12 h-12 mx-auto text-emerald-600 stroke-1 mb-2" />
                      <p className="font-bold text-base">¡El inventario está en niveles óptimos!</p>
                      <p className="text-xs text-emerald-700 mt-1">Ningún producto está actualmente por debajo de su stock mínimo de seguridad.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {uniqueSuppliers.map(suppName => {
                        const suppProducts = lowStockProducts.filter(p => (p.supplier || 'Sin Proveedor') === suppName)
                        if (suppProducts.length === 0) return null

                        const suppObj = suppliers.find(s => s.name === suppName)

                        return (
                          <div key={suppName} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                                  <Truck className="w-4 h-4 text-primary" /> {suppName}
                                </h3>
                                <span className="bg-amber-100 text-amber-800 font-extrabold text-xs px-2.5 py-0.5 rounded-full">
                                  {suppProducts.length} {suppProducts.length === 1 ? 'producto' : 'productos'}
                                </span>
                              </div>

                              {suppObj && (
                                <div className="text-xs text-gray-500 mb-3 pb-3 border-b border-gray-100 flex flex-col gap-1">
                                  {suppObj.contact_person && <p>👤 Contacto: {suppObj.contact_person}</p>}
                                  {suppObj.phone && <p>📞 Teléfono: {suppObj.phone}</p>}
                                </div>
                              )}

                              <div className="space-y-2 mt-2">
                                {suppProducts.map(p => (
                                  <div key={p.id} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-gray-50">
                                    <span className="font-medium text-gray-800 truncate max-w-[160px]">{p.name}</span>
                                    <div className="text-right">
                                      <span className="text-red-600 font-bold">{p.stock} uds</span>
                                      <span className="text-gray-400 text-[10px] ml-1">(Mín: {p.min_stock_level ?? 5})</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="mt-5 pt-3 border-t border-gray-100 flex gap-2">
                              <button
                                onClick={() => openOrderModal(suppName)}
                                className="w-full bg-gray-900 hover:bg-black text-white font-bold text-xs py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                              >
                                <ShoppingCart className="w-3.5 h-3.5" /> Preparar Pedido {suppName}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {/* TAB 4: PROVEEDORES */}
          {activeTab === 'suppliers' && (
            <div className="flex flex-col gap-6">

              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Directorio de Proveedores y Comerciales</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Gestiona los datos de contacto de tus marcas, distribuidores y comerciales habituales.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingSupplier(null)
                    setSupplierForm({ name: '', contact_person: '', phone: '', email: '', notes: '' })
                    setIsSupplierModalOpen(true)
                  }}
                  className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" /> Nuevo Proveedor
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {suppliers.map(supp => {
                  const prodCount = products.filter(p => p.supplier === supp.name).length

                  return (
                    <div key={supp.id} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                            <Truck className="w-5 h-5 text-primary" /> {supp.name}
                          </h3>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                            {prodCount} {prodCount === 1 ? 'producto' : 'productos'}
                          </span>
                        </div>

                        <div className="space-y-2 mt-4 text-xs text-gray-600">
                          {supp.contact_person && (
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-700">Comercial:</span> {supp.contact_person}
                            </div>
                          )}

                          {supp.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5 text-gray-400" />
                              <a href={`tel:${supp.phone}`} className="hover:text-primary font-medium">{supp.phone}</a>
                            </div>
                          )}

                          {supp.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="w-3.5 h-3.5 text-gray-400" />
                              <a href={`mailto:${supp.email}`} className="hover:text-primary font-medium">{supp.email}</a>
                            </div>
                          )}

                          {supp.notes && (
                            <div className="p-2.5 bg-gray-50 rounded-xl text-gray-600 mt-2 text-[11px]">
                              {supp.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between">
                        <button
                          onClick={() => {
                            setEditingSupplier(supp.id)
                            setSupplierForm({
                              name: supp.name || '',
                              contact_person: supp.contact_person || '',
                              phone: supp.phone || '',
                              email: supp.email || '',
                              notes: supp.notes || ''
                            })
                            setIsSupplierModalOpen(true)
                          }}
                          className="text-xs font-bold text-gray-600 hover:text-primary flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Editar
                        </button>

                        <button
                          onClick={() => handleDeleteSupplier(supp.id)}
                          className="text-xs font-bold text-gray-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}

                {suppliers.length === 0 && (
                  <div className="col-span-full py-16 text-center text-gray-400 bg-white rounded-2xl border border-gray-200 border-dashed">
                    <Truck className="w-12 h-12 mx-auto text-gray-300 stroke-1 mb-2" />
                    <p className="font-semibold text-gray-700 text-sm">No hay proveedores registrados todavía.</p>
                    <p className="text-xs text-gray-400 mt-1">Añade los datos de tus marcas y distribuidores para enviar pedidos rápidamente.</p>
                  </div>
                )}
              </div>

            </div>
          )}
        </>
      )}

      {/* --- MODAL 1: NUEVO / EDITAR PRODUCTO --- */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" /> {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
            </h2>

            <form onSubmit={handleProductSubmit} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Nombre del Producto *</label>
                <input
                  required
                  type="text"
                  className="w-full border border-gray-200 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none"
                  value={productForm.name}
                  onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="Ej: Champú Reparación Intensa 500ml"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Categoría</label>
                  <input
                    type="text"
                    list="categories-list"
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none"
                    value={productForm.category}
                    onChange={e => setProductForm({ ...productForm, category: e.target.value })}
                    placeholder="Ej: Champús, Tintes..."
                  />
                  <datalist id="categories-list">
                    <option value="Tintes" />
                    <option value="Champús" />
                    <option value="Tratamientos" />
                    <option value="Mascarillas" />
                    <option value="Acabado y Styling" />
                    <option value="Estética y Cosmética" />
                  </datalist>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Marca / Proveedor</label>
                  <input
                    type="text"
                    list="suppliers-list"
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none"
                    value={productForm.supplier}
                    onChange={e => setProductForm({ ...productForm, supplier: e.target.value })}
                    placeholder="Ej: L'Oréal, Salerm..."
                  />
                  <datalist id="suppliers-list">
                    {suppliers.map(s => <option key={s.id} value={s.name} />)}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">PVP Venta (€) *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-primary/40 focus:outline-none"
                    value={productForm.price}
                    onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Precio Coste (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-sm text-gray-700 focus:ring-2 focus:ring-primary/40 focus:outline-none"
                    value={productForm.cost_price}
                    onChange={e => setProductForm({ ...productForm, cost_price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block font-bold text-amber-700 mb-1">Stock Mínimo (uds) *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    className="w-full border border-amber-200 bg-amber-50 p-2.5 rounded-xl text-sm font-bold text-amber-900 focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                    value={productForm.min_stock_level}
                    onChange={e => setProductForm({ ...productForm, min_stock_level: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Cantidad sugerida al hacer pedidos</p>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Código de Barras / Ref. SKU</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none font-mono"
                  value={productForm.barcode}
                  onChange={e => setProductForm({ ...productForm, barcode: e.target.value })}
                  placeholder="Ej: 8435123456789"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Descripción</label>
                <textarea
                  className="w-full border border-gray-200 p-2.5 rounded-xl text-xs h-16 focus:ring-2 focus:ring-primary/40 focus:outline-none"
                  value={productForm.description}
                  onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="Notas técnicas, formato o ingredientes..."
                />
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="bg-primary hover:bg-primary/90 text-white font-bold px-5 py-2 rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? 'Guardando...' : editingProduct ? 'Actualizar Producto' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: REGISTRAR ENTRADA (ALBARÁN) --- */}
      {isRestockModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-2xl max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <ArrowUpRight className="w-5 h-5 text-emerald-600" /> Registrar Entrada de Stock (Albarán)
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Añade unidades recibidas de tus proveedores al inventario.</p>
              </div>
              <button onClick={() => setIsRestockModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
              {/* Banner de pedido vinculado */}
              {linkedOrderId && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-800">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Recepcionando Pedido <strong>{restockReason.replace('Recepción Pedido ', '')}</strong> de <strong>{restockSupplier || 'Proveedor'}</strong></span>
                  </div>
                  <span className="bg-emerald-200 text-emerald-900 font-extrabold px-2 py-0.5 rounded-full text-[10px]">Recepción 1-Clic</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Proveedor / Distribuidor</label>
                  <input
                    type="text"
                    list="suppliers-list"
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-sm"
                    value={restockSupplier}
                    onChange={e => setRestockSupplier(e.target.value)}
                    placeholder="Ej: L'Oréal, Salerm..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Concepto / Nº Factura Proveedor</label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-sm"
                    value={restockReason}
                    onChange={e => setRestockReason(e.target.value)}
                    placeholder="Ej: Pedido #1234 mensual"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Añadir Producto</label>
                <select
                  className="w-full border border-gray-200 p-2.5 rounded-xl text-sm bg-white font-medium"
                  onChange={e => {
                    addProductToRestock(e.target.value)
                    e.target.value = ''
                  }}
                >
                  <option value="">-- Selecciona un producto para añadirlo al albarán --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock actual: {p.stock} uds)
                    </option>
                  ))}
                </select>
              </div>

              {restockCart.length > 0 && (
                <div className="mt-2">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Productos a Incrementar:</h4>
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                    {restockCart.map((item, idx) => (
                      <div key={item.product_id} className="p-3 bg-white flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-bold text-gray-900 text-sm">{item.name}</p>
                          <p className="text-xs text-gray-500">Stock actual: {item.current_stock} uds ➔ Quedará: {item.current_stock + item.quantity} uds</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-600 font-extrabold">+</span>
                            <input
                              type="number"
                              min="1"
                              className="w-16 border border-gray-200 p-1.5 rounded-lg text-center font-bold text-sm"
                              value={item.quantity}
                              onChange={e => {
                                const q = parseInt(e.target.value) || 1
                                const copy = [...restockCart]
                                copy[idx].quantity = q
                                setRestockCart(copy)
                              }}
                            />
                            <span className="text-xs text-gray-500">uds</span>
                          </div>
                          <button
                            onClick={() => setRestockCart(restockCart.filter((_, i) => i !== idx))}
                            className="text-gray-400 hover:text-red-500 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Casilla para generar factura asociada */}
              <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Receipt className="w-4 h-4 text-primary shrink-0" />
                  <input
                    type="checkbox"
                    id="create_invoice_restock"
                    checked={createInvoiceOnRestock}
                    onChange={e => setCreateInvoiceOnRestock(e.target.checked)}
                    className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="create_invoice_restock" className="text-xs font-semibold text-gray-700 cursor-pointer">
                    Crear Factura en Gastos y Facturas
                  </label>
                </div>

                {createInvoiceOnRestock && (
                  <div className="flex flex-wrap items-center gap-2 pl-6 sm:pl-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-gray-500 whitespace-nowrap">Pago:</span>
                      <select
                        value={restockPaymentMethod}
                        onChange={e => {
                          const val = e.target.value
                          setRestockPaymentMethod(val)
                          if (val === 'promissory_note' && restockPaymentDays === '0') {
                            setRestockPaymentDays('30')
                          }
                        }}
                        className="border border-gray-200 p-1.5 rounded-lg text-xs bg-white font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
                      >
                        <option value="direct_debit">Domiciliación Bancaria (Recibo)</option>
                        <option value="promissory_note">Pagaré / Efecto Comercial</option>
                        <option value="transfer">Transferencia Bancaria</option>
                        <option value="card">Tarjeta de Empresa</option>
                        <option value="cash">Efectivo (Caja)</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-gray-500 whitespace-nowrap">Plazo:</span>
                      <select
                        value={restockPaymentDays}
                        onChange={e => setRestockPaymentDays(e.target.value)}
                        className="border border-gray-200 p-1.5 rounded-lg text-xs bg-white font-bold text-primary focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
                      >
                        <option value="0">Al momento (Hoy)</option>
                        <option value="30">Aplazado 30 días</option>
                        <option value="60">Aplazado 60 días</option>
                        <option value="90">Aplazado 90 días</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button
                type="button"
                onClick={() => {
                  setIsRestockModalOpen(false)
                  setLinkedOrderId(null)
                  setCreateInvoiceOnRestock(false)
                }}
                className="px-4 py-2 font-bold text-xs text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleRestockSubmit}
                disabled={isProcessing || restockCart.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? 'Guardando Albarán...' : <><CheckCircle className="w-4 h-4" /> Guardar Entrada de Stock</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: REGISTRAR SALIDA / CONSUMO INTERNO --- */}
      {isConsumptionModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-2xl max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <ArrowDownRight className="w-5 h-5 text-red-600" /> Registrar Salida / Consumo Interno
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Descuenta productos consumidos en el salón o mermas de almacén.</p>
              </div>
              <button onClick={() => setIsConsumptionModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Motivo de la Salida *</label>
                  <select
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-sm bg-white"
                    value={consumptionReason}
                    onChange={e => setConsumptionReason(e.target.value)}
                  >
                    <option value="Consumo Interno (Lavacabezas / Salón)">Consumo Interno (Lavacabezas / Salón)</option>
                    <option value="Uso en Cabina Estética">Uso en Cabina Estética</option>
                    <option value="Merma / Rotura">Merma / Rotura Accidental</option>
                    <option value="Producto Caducado / Deteriorado">Producto Caducado / Deteriorado</option>
                    <option value="Ajuste de Inventario">Ajuste de Inventario</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Observaciones / Profesional</label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-sm"
                    value={consumptionNotes}
                    onChange={e => setConsumptionNotes(e.target.value)}
                    placeholder="Ej: Tinte retirado por Marina..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Añadir Producto a Retirar</label>
                <select
                  className="w-full border border-gray-200 p-2.5 rounded-xl text-sm bg-white font-medium"
                  onChange={e => {
                    addProductToConsumption(e.target.value)
                    e.target.value = ''
                  }}
                >
                  <option value="">-- Selecciona un producto para descontar --</option>
                  {products.filter(p => p.stock > 0).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock disponible: {p.stock} uds)
                    </option>
                  ))}
                </select>
              </div>

              {consumptionCart.length > 0 && (
                <div className="mt-2">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Productos a Descontar:</h4>
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                    {consumptionCart.map((item, idx) => (
                      <div key={item.product_id} className="p-3 bg-white flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-bold text-gray-900 text-sm">{item.name}</p>
                          <p className="text-xs text-gray-500">Stock actual: {item.current_stock} uds ➔ Quedará: {item.current_stock - item.quantity} uds</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-red-600 font-extrabold">-</span>
                            <input
                              type="number"
                              min="1"
                              max={item.current_stock}
                              className="w-16 border border-gray-200 p-1.5 rounded-lg text-center font-bold text-sm"
                              value={item.quantity}
                              onChange={e => {
                                const q = Math.min(item.current_stock, parseInt(e.target.value) || 1)
                                const copy = [...consumptionCart]
                                copy[idx].quantity = q
                                setConsumptionCart(copy)
                              }}
                            />
                            <span className="text-xs text-gray-500">uds</span>
                          </div>
                          <button
                            onClick={() => setConsumptionCart(consumptionCart.filter((_, i) => i !== idx))}
                            className="text-gray-400 hover:text-red-500 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setIsConsumptionModalOpen(false)}
                className="px-4 py-2 font-bold text-xs text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConsumptionSubmit}
                disabled={isProcessing || consumptionCart.length === 0}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? 'Registrando...' : <><CheckCircle className="w-4 h-4" /> Confirmar Salida de Stock</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 4: VISTA PREVIA Y ENVÍO DE PEDIDO A PROVEEDOR --- */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-3xl max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-primary" /> Preparar Pedido de Reposición
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Genera la orden de compra, descárgala en PDF, envíala por WhatsApp o guárdala como pendiente para recepcionarla en 1 clic.
                </p>
              </div>
              <button onClick={() => setIsOrderModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
              {/* Selector de proveedor y selector rápido para añadir más productos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50/80 p-3.5 rounded-xl border border-gray-200">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Proveedor del Pedido</label>
                  <select
                    value={orderSupplier}
                    onChange={e => setOrderSupplier(e.target.value)}
                    className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="all">Multimarca / Varios Proveedores</option>
                    {uniqueSuppliers.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Añadir otro producto al pedido</label>
                  <select
                    className="w-full border border-gray-200 p-2 rounded-lg text-xs bg-white font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    onChange={e => {
                      addProductToOrder(e.target.value)
                      e.target.value = ''
                    }}
                  >
                    <option value="">-- Seleccionar producto del catálogo --</option>
                    {products
                      .filter(p => orderSupplier === 'all' || !orderSupplier || p.supplier === orderSupplier)
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} {orderSupplier === 'all' && p.supplier ? `(${p.supplier})` : ''} · Stock: {p.stock} uds
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {orderCart.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-gray-400">
                  <ShoppingCart className="w-10 h-10 mx-auto text-gray-300 stroke-1 mb-2" />
                  <p className="font-semibold text-xs text-gray-600">El carrito de pedido está vacío</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Usa el desplegable superior para agregar productos a solicitar a este proveedor.</p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50/80 border-b border-gray-100 font-bold text-gray-600">
                      <tr>
                        <th className="p-3">Producto</th>
                        <th className="p-3">Proveedor</th>
                        <th className="p-3 text-center">Stock Actual</th>
                        <th className="p-3 text-center">Mínimo</th>
                        <th className="p-3 text-center">A Pedir</th>
                        <th className="p-3 text-right">Coste Est.</th>
                        <th className="p-3 text-center">Quitar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {orderCart.map((item, idx) => {
                        const itemSubtotal = (parseFloat(item.cost_price) || 0) * item.quantity
                        return (
                          <tr key={item.product_id} className="hover:bg-gray-50/50">
                            <td className="p-3 font-bold text-gray-900">{item.name}</td>
                            <td className="p-3 text-gray-500">{item.supplier}</td>
                            <td className="p-3 text-center font-bold text-red-600">{item.stock} uds</td>
                            <td className="p-3 text-center text-gray-500">{item.min_stock_level} uds</td>
                            <td className="p-3 text-center">
                              <input
                                type="number"
                                min="1"
                                className="w-16 border border-primary/40 bg-primary/5 p-1.5 rounded-lg text-center font-black text-sm text-primary"
                                value={item.quantity}
                                onChange={e => {
                                  const q = parseInt(e.target.value) || 1
                                  const copy = [...orderCart]
                                  copy[idx].quantity = q
                                  setOrderCart(copy)
                                }}
                              />
                            </td>
                            <td className="p-3 text-right font-semibold text-gray-700">
                              {itemSubtotal > 0 ? `${itemSubtotal.toFixed(2)}€` : '-'}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => setOrderCart(orderCart.filter((_, i) => i !== idx))}
                                className="text-gray-400 hover:text-red-500 p-1 cursor-pointer"
                                title="Eliminar del pedido"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/50 rounded-b-2xl">
              <div>
                <span className="text-xs font-semibold text-gray-600 block">
                  Total productos: <strong>{orderCart.length}</strong> (Unidades: <strong>{orderCart.reduce((s, i) => s + i.quantity, 0)}</strong>)
                </span>
                {orderCart.some(i => (parseFloat(i.cost_price) || 0) > 0) && (
                  <span className="text-xs text-gray-500">
                    Coste estimado: <strong className="text-gray-900 font-bold">{orderCart.reduce((s, i) => s + ((parseFloat(i.cost_price) || 0) * i.quantity), 0).toFixed(2)}€</strong>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleGenerateOrderPDF}
                  disabled={orderCart.length === 0}
                  className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-bold text-xs px-3.5 py-2.5 rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <FileText className="w-4 h-4 text-primary" /> Descargar PDF
                </button>

                <button
                  type="button"
                  onClick={handleSendOrderWhatsApp}
                  disabled={orderCart.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Share2 className="w-4 h-4" /> WhatsApp
                </button>

                <button
                  type="button"
                  onClick={handleEmitPurchaseOrder}
                  disabled={isProcessing || orderCart.length === 0}
                  className="bg-primary hover:bg-primary/90 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? 'Guardando...' : <><CheckCircle className="w-4 h-4" /> Emitir y Guardar Pedido</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 5: NUEVO / EDITAR PROVEEDOR --- */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" /> {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            </h2>

            <form onSubmit={handleSupplierSubmit} className="flex flex-col gap-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Nombre de la Empresa / Marca *</label>
                <input
                  required
                  type="text"
                  className="w-full border border-gray-200 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none"
                  value={supplierForm.name}
                  onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  placeholder="Ej: L'Oréal Professionnel, Salerm..."
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Persona de Contacto / Comercial</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none"
                  value={supplierForm.contact_person}
                  onChange={e => setSupplierForm({ ...supplierForm, contact_person: e.target.value })}
                  placeholder="Ej: Juan Pérez (Comercial Zona)"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="tel"
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none"
                    value={supplierForm.phone}
                    onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    placeholder="Ej: 600123456"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Email de Pedidos</label>
                  <input
                    type="email"
                    className="w-full border border-gray-200 p-2.5 rounded-xl text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none"
                    value={supplierForm.email}
                    onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })}
                    placeholder="pedidos@marca.com"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Notas / Condiciones comerciales</label>
                <textarea
                  className="w-full border border-gray-200 p-2.5 rounded-xl text-xs h-20 focus:ring-2 focus:ring-primary/40 focus:outline-none"
                  value={supplierForm.notes}
                  onChange={e => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                  placeholder="Día de reparto semanal, portes gratis a partir de 150€, descuentos especiales..."
                />
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="bg-primary hover:bg-primary/90 text-white font-bold px-5 py-2 rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? 'Guardando...' : editingSupplier ? 'Actualizar Proveedor' : 'Guardar Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
