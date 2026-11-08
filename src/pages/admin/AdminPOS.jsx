import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, ShoppingCart, User, Clock, Scissors, Package, CreditCard, Banknote, Smartphone, CheckCircle, Trash2, Printer, Mail, History, X, Gift, Star, Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'

async function generateVerifactuHash(nif, invoiceNumber, dateIso, type, total, prevHash) {
  const data = `${nif}|${invoiceNumber}|${dateIso}|${type}|${total.toFixed(2)}|${prevHash || ''}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function AdminPOS() {
  const [searchParams, setSearchParams] = useSearchParams()
  const apptIdParam = searchParams.get('apptId')

  const [appointments, setAppointments] = useState([])
  const [products, setProducts] = useState([])
  const [services, setServices] = useState([])
  const [activeTab, setActiveTab] = useState('products')
  const [loading, setLoading] = useState(true)
  const [isCashClosedToday, setIsCashClosedToday] = useState(false)

  // Settings
  const [settings, setSettings] = useState(null)

  // Carrito (Ticket)
  const [cart, setCart] = useState([]) // { id, name, type: 'service'|'product', price, quantity, appt_id? }
  const [selectedAppt, setSelectedAppt] = useState(null)
  const [allClients, setAllClients] = useState([])
  const [walkInClient, setWalkInClient] = useState(null)

  // Checkout
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('card')
  const [isProcessing, setIsProcessing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [lastSale, setLastSale] = useState(null)
  const [printMode, setPrintMode] = useState('normal') // 'normal' | 'gift'

  // Tarjeta Regalo
  const [appliedGiftCard, setAppliedGiftCard] = useState(null)
  const [giftCardCode, setGiftCardCode] = useState('')

  // Empleados y Comisiones
  const [allStaff, setAllStaff] = useState([])
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [saleNotes, setSaleNotes] = useState('')

  // Historial de Tickets
  const [showHistory, setShowHistory] = useState(false)
  const [historySales, setHistorySales] = useState([])
  const [historyLimit, setHistoryLimit] = useState(100)
  const [historyStartDate, setHistoryStartDate] = useState('')
  const [historyEndDate, setHistoryEndDate] = useState('')

  useEffect(() => {
    if (showHistory) {
      loadHistory()
    }
  }, [showHistory, historyLimit, historyStartDate, historyEndDate])

  const loadHistory = async () => {
    try {
      let query = supabase
        .from('sales')
        .select('*, items:sale_items(*)')
        .order('created_at', { ascending: false })
        .limit(historyLimit)

      if (historyStartDate) {
        const start = new Date(historyStartDate)
        start.setHours(0, 0, 0, 0)
        query = query.gte('created_at', start.toISOString())
      }
      if (historyEndDate) {
        const end = new Date(historyEndDate)
        end.setHours(23, 59, 59, 999)
        query = query.lte('created_at', end.toISOString())
      }

      const { data } = await query
      if (data) setHistorySales(data)
    } catch (e) {
      console.error(e)
    }
  }

  const handleReprint = (sale, mode = 'normal') => {
    setLastSale({
      items: sale.items?.map(i => ({
        name: i.item_name,
        price: Number(i.price),
        quantity: Number(i.quantity)
      })) || [],
      subtotal: Number(sale.total_amount) + Number(sale.discount_amount),
      discount: Number(sale.discount_amount),
      total: Number(sale.total_amount),
      paymentMethod: sale.payment_method,
      date: new Date(sale.created_at),
      invoice_number: sale.invoice_number,
      verifactu_hash: sale.verifactu_hash
    })
    setShowHistory(false)
    setPrintMode(mode)
    
    // Trigger print dialog directly after state update
    setTimeout(() => {
      window.print()
    }, 200)
  }

  // Fidelización
  const [pointsToRedeem, setPointsToRedeem] = useState('')

  // Búsqueda
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      // 1. Obtener citas de HOY que NO estén pagadas/completadas
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date()
      endOfDay.setHours(23, 59, 59, 999)

      const { data: apptsData } = await supabase
        .from('appointments')
        .select(`
          id, start_time, end_time, status, payment_status, items,
          client:clients(id, name, loyalty_points),
          service:services(id, name, price),
          staff:staff(id, name)
        `)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .neq('status', 'cancelled')
        .order('start_time')

      let finalAppts = apptsData || []

      // Si viene un apptId por parámetro que no esté en las citas de hoy, buscarlo en Supabase
      if (apptIdParam) {
        const found = finalAppts.find(a => a.id === apptIdParam)
        if (!found) {
          const { data: specificAppt } = await supabase
            .from('appointments')
            .select(`
              id, start_time, end_time, status, payment_status, items,
              client:clients(id, name, loyalty_points),
              service:services(id, name, price),
              staff:staff(id, name)
            `)
            .eq('id', apptIdParam)
            .single()

          if (specificAppt) {
            finalAppts = [specificAppt, ...finalAppts]
          }
        }
      }

      setAppointments(finalAppts)

      // 2. Obtener productos con stock
      const { data: prodsData } = await supabase
        .from('products')
        .select('*')
        .gt('stock', 0)
        .order('name')

      if (prodsData) setProducts(prodsData)

      // 3. Obtener servicios
      const { data: servsData } = await supabase
        .from('services')
        .select('*')
        .order('name')

      if (servsData) setServices(servsData)

      // 4. Obtener todo el staff para las comisiones
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, name')
        .order('name')

      if (staffData) setAllStaff(staffData)

      // 5. Obtener settings para fidelización
      const { data: settingsData } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .single()

      if (settingsData) setSettings(settingsData)
      
      // 6. Obtener todos los clientes para tickets de paso
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name, loyalty_points')
        .order('name')
        
      if (clientsData) setAllClients(clientsData)

      // 7. Comprobar si la caja de hoy ya ha sido cerrada
      const todayString = new Date().toISOString().split('T')[0]
      const { data: closuresData } = await supabase
        .from('cash_closures')
        .select('id, closure_date, created_at')
        .eq('closure_date', todayString)
        .order('created_at', { ascending: false })

      if (closuresData && closuresData.length > 0) {
        const latestClosure = closuresData[0]
        const { data: reopenData } = await supabase
          .from('cash_movements')
          .select('id')
          .eq('reason', `[SISTEMA_REAPERTURA_CAJA_${todayString}]`)
          .gt('created_at', latestClosure.created_at)

        const reopened = reopenData && reopenData.length > 0
        setIsCashClosedToday(!reopened)
      } else {
        setIsCashClosedToday(false)
      }

    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const addApptToCart = (appt) => {
    if (selectedAppt?.id === appt.id) return;

    const newCart = [];

    // Si la cita NO está pagada, añadimos el servicio principal al carrito
    if (appt.payment_status !== 'paid') {
      if (appt.items && appt.items.length > 0) {
        appt.items.forEach(item => {
          newCart.push({
            id: item.id,
            name: item.name,
            type: item.type,
            price: Number(item.price !== undefined ? item.price : (appt.service?.price || 0)),
            quantity: item.qty || 1,
            appt_id: appt.id,
            client_id: appt.client?.id,
            client_name: appt.client?.name,
            client_loyalty_points: appt.client?.loyalty_points || 0
          });
        });
      } else if (appt.service) { // Fallback para citas antiguas
        newCart.push({
          id: appt.service.id,
          name: appt.service.name,
          type: 'service',
          price: Number(appt.service.price || 0),
          quantity: 1,
          appt_id: appt.id,
          client_id: appt.client?.id,
          client_name: appt.client?.name,
          client_loyalty_points: appt.client?.loyalty_points || 0
        });
      }
    }

    if (appt.staff?.id) {
      setSelectedStaffId(appt.staff.id)
    }

    setCart(newCart);
    setSelectedAppt(appt);
    setPointsToRedeem(''); // reset points
    setAppliedGiftCard(null);
  }

  // Carga automática al carrito si se accede con ?apptId=... (desde la Agenda)
  useEffect(() => {
    if (!apptIdParam || appointments.length === 0) return
    const targetAppt = appointments.find(a => a.id === apptIdParam)
    if (targetAppt && selectedAppt?.id !== targetAppt.id) {
      addApptToCart(targetAppt)
      // Limpiar el parámetro de la URL para evitar recargas accidentales
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('apptId')
      setSearchParams(nextParams, { replace: true })
    }
  }, [apptIdParam, appointments])

  const addExtraServiceToCart = (svc) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === svc.id && item.type === 'service' && !item.appt_id);
      if (existing) {
        return prev.map(item => item.id === svc.id && item.type === 'service' && !item.appt_id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, {
        id: svc.id,
        name: svc.name,
        type: 'service',
        price: svc.price,
        quantity: 1
      }];
    });
  }

  const addProductToCart = (prod) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === prod.id && item.type === 'product');
      if (existing) {
        if (existing.quantity >= prod.stock) return prev; // No hay más stock
        return prev.map(item => item.id === prod.id && item.type === 'product' ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, {
        id: prod.id,
        name: prod.name,
        type: 'product',
        price: prod.price,
        quantity: 1
      }];
    });
  }

  const removeFromCart = (index) => {
    const item = cart[index]
    if (item.type === 'service' && item.appt_id) {
      setSelectedAppt(null)
      setPointsToRedeem('')
    }
    setCart(cart.filter((_, i) => i !== index))
  }

  const updateQuantity = (index, newQty) => {
    if (newQty < 1) return
    const item = cart[index]
    // Validar stock si es un producto
    if (item.type === 'product') {
      const prod = products.find(p => p.id === item.id)
      if (prod && newQty > prod.stock) {
        alert(`Solo hay ${prod.stock} unidades en stock`)
        return
      }
    }
    setCart(cart.map((c, i) => i === index ? { ...c, quantity: newQty } : c))
  }

  // Cliente activo actual (desde cita o cliente de paso seleccionado)
  const currentClient = selectedAppt?.client?.id
    ? (allClients.find(c => c.id === selectedAppt.client.id) || selectedAppt.client)
    : walkInClient;
  const clientLoyaltyPoints = currentClient?.loyalty_points || 0;
  const loyaltyEnabled = Boolean(settings?.loyalty_program_enabled);
  const ptsForDiscount = settings?.loyalty_points_for_discount || 100;
  const ptsPerEuroEarned = settings?.loyalty_points_per_euro || 1;

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  // Fidelización: puntos máximos canjeables y cálculo de descuento
  const remainingBeforePoints = Math.max(0, subtotal - discount);
  const maxPointsForCart = Math.ceil(remainingBeforePoints * ptsForDiscount);
  const maxRedeemablePoints = Math.min(clientLoyaltyPoints, maxPointsForCart);

  const rawPointsToRedeem = Number(pointsToRedeem) || 0;
  const validatedPointsToRedeem = Math.min(rawPointsToRedeem, maxRedeemablePoints);
  const pointsDiscount = (loyaltyEnabled && currentClient) ? (validatedPointsToRedeem / ptsForDiscount) : 0;

  // Descuento por tarjeta regalo
  let giftCardDiscount = 0;
  if (appliedGiftCard) {
    const afterOtherDiscounts = Math.max(0, subtotal - discount - pointsDiscount);
    if (appliedGiftCard.type === 'amount') {
      giftCardDiscount = Math.min(appliedGiftCard.amount_remaining, afterOtherDiscounts);
    } else if (appliedGiftCard.type === 'service') {
      const hasService = cart.some(c => c.id === appliedGiftCard.service_id && c.type === 'service');
      if (hasService) giftCardDiscount = Math.min(appliedGiftCard.service?.price ?? 0, afterOtherDiscounts);
    } else if (appliedGiftCard.type === 'product') {
      const hasProduct = cart.some(c => c.id === appliedGiftCard.product_id && c.type === 'product');
      if (hasProduct) giftCardDiscount = Math.min(appliedGiftCard.product?.price ?? 0, afterOtherDiscounts);
    }
  }

  const total = Math.max(0, subtotal - discount - pointsDiscount - giftCardDiscount)
  const pointsEarned = (loyaltyEnabled && currentClient) ? Math.floor(total * ptsPerEuroEarned) : 0;
  const projectedBalance = Math.max(0, clientLoyaltyPoints - validatedPointsToRedeem + pointsEarned);

  const applyGiftCard = async () => {
    if (!giftCardCode || !giftCardCode.trim()) return;
    try {
      const formattedCode = giftCardCode.trim().toUpperCase();
      const { data, error } = await supabase
        .from('gift_cards')
        .select('*, service:services(*), product:products(*)')
        .eq('code', formattedCode)
        .single();
        
      if (error || !data) return alert('Código de tarjeta no válido');
      if (data.status !== 'active') return alert(`La tarjeta no está activa. Estado: ${data.status}`);
      if (data.expires_at && new Date(data.expires_at) < new Date()) return alert('La tarjeta regalo está caducada');
      if (data.type === 'amount' && data.amount_remaining <= 0) return alert('La tarjeta no tiene saldo disponible');
      
      setAppliedGiftCard(data);
      setGiftCardCode('');
    } catch (err) {
      console.error(err);
      alert('Error al aplicar la tarjeta');
    }
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return alert('El carrito está vacío')

    if (isCashClosedToday) {
      const confirmReopen = window.confirm(
        "⚠️ ¡Atención! La caja de hoy ya ha sido cerrada con su Cierre Z.\n\n" +
        "¿Deseas reabrir la caja automáticamente para poder cobrar y que este ticket se sume al arqueo definitivo de hoy?"
      )
      if (!confirmReopen) return

      // Registrar reapertura sincronizada en cash_movements
      const todayStr = new Date().toISOString().split('T')[0]
      try {
        await supabase
          .from('cash_movements')
          .insert([{
            type: 'in',
            amount: 0,
            reason: `[SISTEMA_REAPERTURA_CAJA_${todayStr}]`,
            payment_method: 'cash'
          }])
        setIsCashClosedToday(false)
      } catch (errReopen) {
        console.warn('Error reabriendo caja:', errReopen)
      }
    }

    if (rawPointsToRedeem > 0) {
      if (rawPointsToRedeem > clientLoyaltyPoints) {
        return alert(`El cliente solo tiene ${clientLoyaltyPoints} puntos.`);
      }
      if (rawPointsToRedeem > maxRedeemablePoints) {
        return alert(`No puedes canjear más de ${maxRedeemablePoints} puntos en esta compra.`);
      }
    }

    setIsProcessing(true)

    try {
      // 0. Preparar datos VeriFactu
      let invoice_number = null;
      let invoice_type = null;
      let base_imponible = null;
      let iva_amount = null;
      let iva_percentage = null;
      let verifactu_hash = null;
      let previous_hash = null;

      if (settings?.verifactu_enabled) {
        invoice_type = 'F2'; // Simplificada
        iva_percentage = 21;
        base_imponible = parseFloat((total / 1.21).toFixed(2));
        iva_amount = parseFloat((total - base_imponible).toFixed(2));

        // Obtener última factura del año actual
        const { data: lastInvoiceData } = await supabase
          .from('sales')
          .select('invoice_number, verifactu_hash')
          .not('invoice_number', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        let nextNum = 1;
        const currentYear2Digits = new Date().getFullYear().toString().slice(-2);
        
        if (lastInvoiceData && lastInvoiceData.invoice_number) {
           const parts = lastInvoiceData.invoice_number.split('-');
           if (parts.length === 2 && parts[0] === `F${currentYear2Digits}`) {
             nextNum = parseInt(parts[1], 10) + 1;
           }
           previous_hash = lastInvoiceData.verifactu_hash;
        }

        invoice_number = `F${currentYear2Digits}-${nextNum.toString().padStart(5, '0')}`;
        
        const dateIso = new Date().toISOString();
        const nif = settings.company_nif || 'DESCONOCIDO';

        verifactu_hash = await generateVerifactuHash(nif, invoice_number, dateIso, invoice_type, total, previous_hash);
      }

      // 1. Crear Venta (Sale)
      const clientId = selectedAppt?.client?.id || walkInClient?.id || null
      const apptId = selectedAppt?.id || null

      const { data: saleData, error: saleErr } = await supabase
        .from('sales')
        .insert([{
          client_id: clientId,
          appointment_id: apptId,
          staff_id: selectedStaffId || null,
          total_amount: total,
          discount_amount: discount + pointsDiscount + giftCardDiscount,
          payment_method: paymentMethod,
          notes: saleNotes,
          invoice_number,
          invoice_type,
          base_imponible,
          iva_amount,
          iva_percentage,
          verifactu_hash,
          previous_hash
        }])
        .select()
        .single()

      if (saleErr) throw saleErr

      // 2. Crear Sale Items
      const saleItems = cart.map(item => ({
        sale_id: saleData.id,
        item_type: item.type === 'new_gift_card' ? 'product' : item.type,
        item_id: item.type === 'new_gift_card' ? '00000000-0000-0000-0000-000000000000' : item.id,
        item_name: item.name,
        quantity: item.quantity,
        price: item.price
      }))

      const { error: itemsErr } = await supabase.from('sale_items').insert(saleItems)
      if (itemsErr) throw itemsErr

      // 3. Si hay cita, marcarla como pagada
      if (apptId) {
        await supabase
          .from('appointments')
          .update({ status: 'completed', payment_status: 'paid' })
          .eq('id', apptId)
      }

      // 4. Reducir stock de productos vendidos y registrar movimiento
      const productsSold = cart.filter(item => item.type === 'product')
      if (productsSold.length > 0) {
        // Registrar movimiento de salida
        const { data: movData, error: movError } = await supabase
          .from('stock_movements')
          .insert([{ type: 'out', reason: 'Venta TPV' }])
          .select()
          .single()

        if (!movError && movData) {
          const movItems = productsSold.map(p => ({
            movement_id: movData.id,
            product_id: p.id,
            quantity: p.quantity
          }))
          await supabase.from('stock_movement_items').insert(movItems)
        }

        // Actualizar stock
        for (const prod of productsSold) {
          const { data: currProd } = await supabase.from('products').select('stock').eq('id', prod.id).single()
          if (currProd) {
            await supabase
              .from('products')
              .update({ stock: currProd.stock - prod.quantity })
              .eq('id', prod.id)
          }
        }
      }

      // 4.1 Generar nuevas tarjetas regalo si se han vendido
      const newGiftCards = cart.filter(c => c.type === 'new_gift_card');
      let autoNotes = saleNotes;
      for (const ngc of newGiftCards) {
        for (let i = 0; i < ngc.quantity; i++) {
          const code = 'GIFT-' + Math.random().toString(36).substring(2, 8).toUpperCase();
          const expirationDate = new Date();
          expirationDate.setMonth(expirationDate.getMonth() + 12);

          const { error: gcError } = await supabase.from('gift_cards').insert({
            code,
            type: ngc.gift_type,
            status: 'active',
            amount_initial: ngc.amount,
            amount_remaining: ngc.amount,
            sender_name: 'Venta en Salón',
            recipient_name: 'Venta en Salón',
            expires_at: expirationDate.toISOString()
          });
          
          if (gcError) throw gcError;
          
          autoNotes += (autoNotes ? '\n' : '') + `Regalo generado: ${code}`;
        }
      }
      
      if (autoNotes !== saleNotes) {
        await supabase.from('sales').update({ notes: autoNotes }).eq('id', saleData.id);
      }

      // 4.2 Consumir tarjeta regalo aplicada
      let appliedGiftCardInfo = null;
      if (appliedGiftCard) {
        let remainingAfter = 0;
        if (appliedGiftCard.type === 'amount') {
          remainingAfter = Math.max(0, appliedGiftCard.amount_remaining - giftCardDiscount);
          await supabase.from('gift_cards').update({ 
            amount_remaining: remainingAfter,
            status: remainingAfter <= 0 ? 'used' : 'active'
          }).eq('id', appliedGiftCard.id);
          autoNotes += (autoNotes ? '\n' : '') + `Canje tarjeta regalo: ${appliedGiftCard.code} (-${giftCardDiscount.toFixed(2)}€) | Saldo rest: ${remainingAfter.toFixed(2)}€`;
        } else {
          await supabase.from('gift_cards').update({ status: 'used' }).eq('id', appliedGiftCard.id);
          autoNotes += (autoNotes ? '\n' : '') + `Canje tarjeta regalo: ${appliedGiftCard.code} (-${giftCardDiscount.toFixed(2)}€)`;
        }
        appliedGiftCardInfo = {
          code: appliedGiftCard.code,
          type: appliedGiftCard.type,
          discount: giftCardDiscount,
          remaining: remainingAfter
        };
      }

      if (autoNotes !== saleNotes) {
        await supabase.from('sales').update({ notes: autoNotes }).eq('id', saleData.id);
      }

      // 5. Fidelización: Actualizar puntos del cliente
      let newLoyaltyPoints = clientLoyaltyPoints;
      if (clientId && loyaltyEnabled) {
        newLoyaltyPoints = Math.max(0, clientLoyaltyPoints - validatedPointsToRedeem + pointsEarned);

        await supabase
          .from('clients')
          .update({ loyalty_points: newLoyaltyPoints })
          .eq('id', clientId);

        // Registrar trazabilidad en el expediente del cliente
        if (validatedPointsToRedeem > 0 || pointsEarned > 0) {
          const logParts = [];
          if (validatedPointsToRedeem > 0) logParts.push(`Canjeados ${validatedPointsToRedeem} pts (-${pointsDiscount.toFixed(2)}€)`);
          if (pointsEarned > 0) logParts.push(`Ganados +${pointsEarned} pts`);
          logParts.push(`Saldo final: ${newLoyaltyPoints} pts`);

          await supabase.from('client_notes').insert([{
            client_id: clientId,
            content: `🎁 Fidelización TPV: ${logParts.join(' | ')}`
          }]);
        }
      }

      // Éxito
      setLastSale({
        items: [...cart],
        subtotal,
        discount,
        pointsDiscount,
        pointsRedeemed: validatedPointsToRedeem,
        pointsEarned,
        newPointsBalance: (clientId && loyaltyEnabled) ? newLoyaltyPoints : undefined,
        clientName: currentClient?.name || null,
        giftCardDiscount,
        total,
        paymentMethod,
        date: new Date(),
        invoice_number,
        verifactu_hash,
        giftCodes: autoNotes !== saleNotes ? autoNotes : null,
        appliedGiftCardInfo
      })
      setSuccess(true)
      setCart([])
      setSelectedAppt(null)
      setWalkInClient(null)
      setSelectedStaffId('')
      setSaleNotes('')
      setDiscount(0)
      setPointsToRedeem('')
      setAppliedGiftCard(null)
      setGiftCardCode('')

      // Recargar datos en segundo plano
      fetchData()

    } catch (err) {
      console.error(err)
      alert('Error al procesar el cobro')
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePrint = (mode = 'normal') => {
    setPrintMode(mode)
    setTimeout(() => {
      window.print()
    }, 200)
  }

  const handleEmail = () => {
    if (!lastSale) return

    const baseImponible = lastSale.total / 1.21
    const iva = lastSale.total - baseImponible

    let body = `¡Gracias por visitar ${settings?.company_name || 'Ohana Peluquería y Estética'}!\n\n`
    if (lastSale.invoice_number) {
      body += `Factura Simplificada: ${lastSale.invoice_number}\n\n`
    }
    body += `Resumen de tu ticket:\n`
    body += `------------------------\n`
    lastSale.items.forEach(item => {
      body += `${item.quantity}x ${item.name} - ${(item.price * item.quantity).toFixed(2)}€\n`
    })
    body += `------------------------\n`
    body += `Subtotal: ${lastSale.subtotal.toFixed(2)}€\n`
    if (lastSale.discount > 0) body += `Descuento: -${lastSale.discount.toFixed(2)}€\n`
    body += `Base Imponible: ${baseImponible.toFixed(2)}€\n`
    body += `IVA (21%): ${iva.toFixed(2)}€\n`
    body += `TOTAL: ${lastSale.total.toFixed(2)}€\n\n`
    body += `Método de pago: ${lastSale.paymentMethod === 'cash' ? 'Efectivo' : lastSale.paymentMethod === 'card' ? 'Tarjeta' : 'Bizum'}\n\n`
    body += `¡Esperamos verte pronto!`

    const encodedBody = encodeURIComponent(body)
    const encodedSubject = encodeURIComponent("Ticket en Ohana Peluquería y Estética")

    window.location.href = `mailto:?subject=${encodedSubject}&body=${encodedBody}`
  }

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
  const filteredServices = services.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50 overflow-hidden">

      {/* Columna Izquierda: Citas y Productos */}
      <div className="flex-1 overflow-auto p-6 flex flex-col gap-6">

        {/* Sección de Citas Pendientes */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Citas de hoy
          </h2>

          {loading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : appointments.length === 0 ? (
            <div className="bg-white p-6 rounded-xl border border-gray-200 text-center text-gray-500 shadow-sm">
              No hay citas para el día de hoy.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {appointments.map(appt => (
                <div
                  key={appt.id}
                  onClick={() => addApptToCart(appt)}
                  className={`bg-white p-4 rounded-xl border shadow-sm cursor-pointer transition-all hover:border-primary hover:shadow-md
                    ${selectedAppt?.id === appt.id ? 'border-primary ring-1 ring-primary' : 'border-gray-200'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-gray-900">{appt.client?.name || 'Cliente sin nombre'}</span>
                    <div className="flex gap-2">
                      {appt.payment_status === 'paid' && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          Pagado
                        </span>
                      )}
                      <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded-full">
                        {new Date(appt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 mb-3 truncate">
                    {appt.items
                      ? appt.items.map(i => i.name).join(' + ')
                      : (appt.service?.name)}
                  </div>

                  <div className="flex items-center justify-between mt-auto">
                    <span className="font-bold text-gray-900">
                      {appt.items
                        ? `${appt.items.reduce((sum, i) => sum + (i.price * (i.qty || 1)), 0)}€`
                        : `${appt.service?.price}€`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sección de Catálogo (Productos / Servicios) */}
        <section className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('products')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${activeTab === 'products' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Package className="w-4 h-4" /> Productos
              </button>
              <button
                onClick={() => setActiveTab('services')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${activeTab === 'services' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Scissors className="w-4 h-4" /> Servicios
              </button>
              <button
                onClick={() => setActiveTab('gifts')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all flex items-center gap-2 ${activeTab === 'gifts' ? 'bg-white shadow-sm text-orange-500' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Gift className="w-4 h-4" /> Regalos
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar..."
                className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTab === 'products' ? (
              filteredProducts.map(prod => (
                <div
                  key={prod.id}
                  onClick={() => addProductToCart(prod)}
                  className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:border-blue-500 hover:shadow-md transition-all flex flex-col"
                >
                  <div className="font-semibold text-gray-900 mb-1">{prod.name}</div>
                  <div className="text-xs text-gray-400 mb-3">Stock: {prod.stock}</div>
                  <div className="font-bold text-gray-900 mt-auto">{prod.price}€</div>
                </div>
              ))
            ) : activeTab === 'services' ? (
              filteredServices.map(svc => (
                <div
                  key={svc.id}
                  onClick={() => addExtraServiceToCart(svc)}
                  className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:border-primary hover:shadow-md transition-all flex flex-col"
                >
                  <div className="font-semibold text-gray-900 mb-1">{svc.name}</div>
                  <div className="text-xs text-gray-400 mb-3">{svc.duration_minutes} min</div>
                  <div className="font-bold text-gray-900 mt-auto">{svc.price}€</div>
                </div>
              ))
            ) : (
              [30, 50, 100].map(amt => (
                <div
                  key={`gift-${amt}`}
                  onClick={() => setCart(prev => [...prev, { id: `gift-${amt}`, type: 'new_gift_card', name: `Tarjeta Regalo ${amt}€`, price: amt, quantity: 1, gift_type: 'amount', amount: amt }])}
                  className="bg-orange-50 p-4 rounded-xl border border-orange-200 shadow-sm cursor-pointer hover:border-orange-500 hover:shadow-md transition-all flex flex-col items-center justify-center text-center"
                >
                  <Gift className="w-8 h-8 text-orange-500 mb-2" />
                  <div className="font-semibold text-orange-900 mb-1">Tarjeta Regalo</div>
                  <div className="font-bold text-orange-900 mt-auto text-xl">{amt}€</div>
                </div>
              ))
            )}
          </div>
        </section>

      </div>

      {/* Columna Derecha: El Ticket (Carrito) */}
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col shadow-xl z-10">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-gray-700" /> Nuevo Ticket
            </h2>
            <button 
              onClick={() => setShowHistory(true)}
              className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
              title="Historial de Tickets de Hoy"
            >
              <History className="w-5 h-5" />
            </button>
          </div>

          {isCashClosedToday && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-2 text-xs text-amber-900 animate-in fade-in">
              <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Caja cerrada hoy</p>
                <p className="text-[11px] text-amber-700 leading-snug">
                  Al cobrar, la caja se reabrirá automáticamente para incluir este ticket en el arqueo.
                </p>
              </div>
            </div>
          )}
          {selectedAppt ? (
            <div className="mt-3 text-sm bg-primary/10 text-primary px-3 py-2 rounded-lg flex flex-col gap-1 font-medium">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" /> Cliente: {currentClient?.name || selectedAppt.client?.name}
              </div>
              {loyaltyEnabled && (
                <div className="text-xs font-semibold text-primary/80 ml-6 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                  Saldo de puntos: {clientLoyaltyPoints} pts ({ (clientLoyaltyPoints / ptsForDiscount).toFixed(2) }€)
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Cliente (Opcional)</label>
              <select
                className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-primary bg-white"
                value={walkInClient?.id || ''}
                onChange={e => {
                  if (!e.target.value) {
                    setWalkInClient(null)
                  } else {
                    const c = allClients.find(client => client.id === e.target.value)
                    setWalkInClient(c || null)
                  }
                  setPointsToRedeem('')
                }}
              >
                <option value="">-- Cliente de paso (Sin registrar) --</option>
                {allClients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {loyaltyEnabled && (c.loyalty_points || 0) > 0 ? `⭐ (${c.loyalty_points} pts)` : ''}
                  </option>
                ))}
              </select>
              {loyaltyEnabled && walkInClient ? (
                <div className="text-xs font-semibold text-primary mt-1.5 ml-1 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                  Saldo de puntos: {clientLoyaltyPoints} pts ({ (clientLoyaltyPoints / ptsForDiscount).toFixed(2) }€)
                </div>
              ) : loyaltyEnabled && (
                <p className="text-[11px] text-gray-400 mt-1.5 ml-1 flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400" />
                  Selecciona un cliente para canjear o sumar puntos
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-6">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
              <ShoppingCart className="w-12 h-12 text-gray-200" />
              <p>El carrito está vacío</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {cart.map((item, i) => (
                <div key={i} className="flex justify-between items-start group bg-white border border-gray-100 p-3 rounded-lg shadow-sm">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {item.type === 'service' ? <Scissors className="w-4 h-4 text-primary" /> : item.type === 'product' ? <Package className="w-4 h-4 text-blue-500" /> : <Gift className="w-4 h-4 text-orange-500" />}
                      <span className="font-bold text-gray-900 text-sm">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <button onClick={() => updateQuantity(i, item.quantity - 1)} className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 font-bold">-</button>
                      <input
                        type="number"
                        min="1"
                        className="w-12 text-center text-sm border border-gray-200 rounded py-0.5 px-1 font-bold bg-gray-50"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(i, parseInt(e.target.value) || 1)}
                      />
                      <button onClick={() => updateQuantity(i, item.quantity + 1)} className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 font-bold">+</button>
                      <span className="text-xs text-gray-500 font-medium ml-1">x {item.price}€</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button onClick={() => removeFromCart(i)} className="text-gray-300 hover:text-red-500 transition-colors p-1 bg-gray-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span className="font-bold text-gray-900 text-lg mt-1">{(item.price * item.quantity).toFixed(2)}€</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 bg-gray-50/50 p-4 flex flex-col gap-3 shrink-0 overflow-y-auto max-h-[50vh]">
          <div className="flex justify-between items-center text-gray-600 text-sm">
            <span>Subtotal</span>
            <span>{subtotal.toFixed(2)}€</span>
          </div>

          {loyaltyEnabled && currentClient && (
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex flex-col gap-2.5 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                  <span className="text-xs font-bold text-amber-900">Club Fidelización</span>
                </div>
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                  {clientLoyaltyPoints} pts ({ (clientLoyaltyPoints / ptsForDiscount).toFixed(2) }€)
                </span>
              </div>

              {clientLoyaltyPoints > 0 ? (
                <div className="flex flex-col gap-2 pt-1 border-t border-amber-200/60">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-amber-950 font-medium">
                      <span>Canjear puntos:</span>
                      <span className="text-[10px] text-amber-700 bg-white/80 px-1.5 py-0.5 rounded border border-amber-200">
                        {ptsForDiscount} pts = 1€
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max={maxRedeemablePoints}
                        value={pointsToRedeem}
                        onChange={e => {
                          const val = e.target.value === '' ? '' : Math.min(maxRedeemablePoints, Math.max(0, Number(e.target.value)));
                          setPointsToRedeem(val);
                        }}
                        className="w-16 border border-amber-300 rounded-lg px-2 py-1 text-right text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white text-amber-900"
                        placeholder="0"
                      />
                      <span className="text-xs font-semibold text-amber-800">pts</span>
                    </div>
                  </div>

                  {/* Botón rápido para Canjear Máximo o Quitar */}
                  <div className="flex items-center justify-between gap-2">
                    {validatedPointsToRedeem > 0 ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                          ✓ Descuento: -{pointsDiscount.toFixed(2)}€
                        </span>
                        <button
                          type="button"
                          onClick={() => setPointsToRedeem('')}
                          className="text-[11px] text-red-600 hover:text-red-800 font-semibold underline cursor-pointer"
                        >
                          Quitar puntos
                        </button>
                      </div>
                    ) : (
                      maxRedeemablePoints > 0 && (
                        <button
                          type="button"
                          onClick={() => setPointsToRedeem(maxRedeemablePoints)}
                          className="w-full text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white py-1.5 px-3 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Gift className="w-3.5 h-3.5" />
                          Canjear máx. ({maxRedeemablePoints} pts = -{(maxRedeemablePoints / ptsForDiscount).toFixed(2)}€)
                        </button>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-amber-800">
                  El cliente aún no tiene puntos para canjear.
                </div>
              )}

              {/* Balance proyección al pagar */}
              <div className="text-[11px] text-amber-900/80 pt-1.5 border-t border-amber-200/50 flex justify-between items-center">
                <span>Acumulará con esta compra:</span>
                <span className="font-bold text-emerald-700">+{pointsEarned} pts (Saldo final: {projectedBalance} pts)</span>
              </div>
            </div>
          )}

          {/* Descuento por puntos si está aplicado */}
          {pointsDiscount > 0 && (
            <div className="flex justify-between items-center text-emerald-600 text-sm font-semibold">
              <span>Desc. Puntos ({validatedPointsToRedeem} pts)</span>
              <span>-{pointsDiscount.toFixed(2)}€</span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-gray-600 text-sm">Desc. Manual</span>
            <div className="flex items-center gap-1">
              <span className="text-gray-400">-</span>
              <input
                type="number"
                min="0"
                max={subtotal}
                value={discount || ''}
                onChange={e => setDiscount(Number(e.target.value))}
                className="w-16 border border-gray-200 rounded px-2 py-1 text-right text-sm focus:outline-none focus:border-primary bg-white"
                placeholder="0"
              />
              <span className="text-gray-600">€</span>
            </div>
          </div>

          <div className="flex flex-col gap-1 mt-1 border-t border-gray-100 pt-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-sm font-medium">Tarjeta Regalo</span>
              {appliedGiftCard ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold bg-primary/10 text-primary px-2 py-1 rounded">
                    {appliedGiftCard.code}: -{giftCardDiscount.toFixed(2)}€
                  </span>
                  <button onClick={() => setAppliedGiftCard(null)} className="text-red-500 hover:text-red-700 text-xs font-bold px-1" title="Quitar tarjeta">✕</button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <input 
                    type="text" 
                    value={giftCardCode} 
                    onChange={e => setGiftCardCode(e.target.value.toUpperCase())} 
                    placeholder="GIFT-XXXXXX"
                    className="w-28 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary uppercase bg-white font-mono"
                  />
                  <button onClick={applyGiftCard} className="bg-primary text-white px-2.5 py-1 rounded text-xs hover:bg-primary/90 font-bold transition shadow-sm" title="Aplicar Tarjeta">✓</button>
                </div>
              )}
            </div>
            {appliedGiftCard && appliedGiftCard.type === 'amount' && (
              <div className="text-[11px] text-gray-500 flex justify-between px-0.5">
                <span>Saldo tarjeta: {appliedGiftCard.amount_remaining.toFixed(2)}€</span>
                <span className="font-semibold text-primary">Restará: {Math.max(0, appliedGiftCard.amount_remaining - giftCardDiscount).toFixed(2)}€</span>
              </div>
            )}
            {appliedGiftCard && appliedGiftCard.type === 'service' && (
              <div className="text-[11px] text-gray-500 px-0.5">
                {giftCardDiscount > 0 ? (
                  <span className="text-emerald-600 font-semibold">✓ Servicio ({appliedGiftCard.service?.name}) bonificado</span>
                ) : (
                  <span className="text-amber-600 font-semibold">⚠ Añade "{appliedGiftCard.service?.name}" al carrito para canjear</span>
                )}
              </div>
            )}
            {appliedGiftCard && appliedGiftCard.type === 'product' && (
              <div className="text-[11px] text-gray-500 px-0.5">
                {giftCardDiscount > 0 ? (
                  <span className="text-emerald-600 font-semibold">✓ Producto ({appliedGiftCard.product?.name}) bonificado</span>
                ) : (
                  <span className="text-amber-600 font-semibold">⚠ Añade "{appliedGiftCard.product?.name}" al carrito para canjear</span>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center text-xl font-bold text-gray-900 pt-3 border-t border-gray-200">
            <span>Total</span>
            <span>{total.toFixed(2)}€</span>
          </div>

          <div className="flex flex-col gap-3 mt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Cobrado por (Comisión)</label>
              <select
                className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-primary"
                value={selectedStaffId}
                onChange={e => setSelectedStaffId(e.target.value)}
              >
                <option value="">-- Sin asignar --</option>
                {allStaff.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Notas del Ticket (Opcional)</label>
              <textarea
                rows="1"
                placeholder="Motivo del cambio de staff u otra nota..."
                className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-primary resize-none"
                value={saleNotes}
                onChange={e => setSaleNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-2">
            <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Método de Pago</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`py-2 px-1 rounded-lg border flex flex-col items-center gap-1 transition-all
                  ${paymentMethod === 'cash' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-500 hover:bg-white'}`}
              >
                <Banknote className="w-5 h-5" />
                <span className="text-[10px] font-bold">Efectivo</span>
              </button>
              <button
                onClick={() => setPaymentMethod('card')}
                className={`py-2 px-1 rounded-lg border flex flex-col items-center gap-1 transition-all
                  ${paymentMethod === 'card' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-500 hover:bg-white'}`}
              >
                <CreditCard className="w-5 h-5" />
                <span className="text-[10px] font-bold">Tarjeta</span>
              </button>
              <button
                onClick={() => setPaymentMethod('bizum')}
                className={`py-2 px-1 rounded-lg border flex flex-col items-center gap-1 transition-all
                  ${paymentMethod === 'bizum' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-500 hover:bg-white'}`}
              >
                <Smartphone className="w-5 h-5" />
                <span className="text-[10px] font-bold">Bizum</span>
              </button>
            </div>
          </div>

          {success ? (
            <div className="bg-white rounded-xl border border-green-200 p-4 animate-in slide-in-from-bottom-2 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-green-600 font-bold justify-center mb-2">
                <CheckCircle className="w-5 h-5" /> Venta Completada
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePrint('normal')}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" /> Ticket Normal
                </button>
                <button
                  onClick={() => handlePrint('gift')}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Gift className="w-4 h-4" /> Ticket Regalo
                </button>
              </div>
              <button
                onClick={handleEmail}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" /> Enviar por Email
              </button>
              <button
                onClick={() => setSuccess(false)}
                className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors mt-2"
              >
                Nueva Venta
              </button>
            </div>
          ) : (
            <button
              onClick={handleCheckout}
              disabled={isProcessing || cart.length === 0}
              className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-gray-900/20 flex items-center justify-center gap-2 mt-2"
            >
              {isProcessing ? 'Procesando...' : `Cobrar ${total.toFixed(2)}€`}
            </button>
          )}

        </div>
      </div>

      {/* MODAL HISTORIAL DE TICKETS */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <History className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900">Historial de Ventas</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <input 
                      type="date"
                      value={historyStartDate}
                      onChange={(e) => setHistoryStartDate(e.target.value)}
                      className="text-xs border-gray-300 rounded px-2 py-1"
                      placeholder="Desde"
                    />
                    <span className="text-gray-400 text-xs">-</span>
                    <input 
                      type="date"
                      value={historyEndDate}
                      onChange={(e) => setHistoryEndDate(e.target.value)}
                      className="text-xs border-gray-300 rounded px-2 py-1"
                      placeholder="Hasta"
                    />
                    {(historyStartDate || historyEndDate) && (
                      <button 
                        onClick={() => { setHistoryStartDate(''); setHistoryEndDate(''); }}
                        className="text-xs text-primary hover:underline ml-2 font-medium"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowHistory(false)
                  setHistoryLimit(100)
                }} 
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 flex-1 bg-gray-50/50">
              {historySales.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>No se encontraron ventas para este periodo.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {historySales.map(sale => (
                    <div key={sale.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between hover:border-gray-300 transition-colors">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-gray-900">{Number(sale.total_amount).toFixed(2)}€</span>
                          {sale.invoice_number && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono font-medium">
                              {sale.invoice_number}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {new Date(sale.created_at).toLocaleDateString()} a las {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          <span>•</span>
                          {sale.payment_method === 'cash' ? 'Efectivo' : sale.payment_method === 'card' ? 'Tarjeta' : 'Bizum'}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReprint(sale, 'normal')}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors"
                          title="Reimprimir ticket normal"
                        >
                          <Printer className="w-4 h-4" /> Reimprimir
                        </button>
                        <button
                          onClick={() => handleReprint(sale, 'gift')}
                          className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center transition-colors"
                          title="Ticket Regalo"
                        >
                          <Gift className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {historySales.length >= historyLimit && (
                    <button
                      onClick={() => setHistoryLimit(prev => prev + 100)}
                      className="w-full py-3 bg-white border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors mt-2"
                    >
                      Cargar más tickets antiguos...
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TICKET PARA IMPRESIÓN (OCULTO EN PANTALLA) */}
      {lastSale && (
        <div id="printable-ticket" className="hidden print:block text-black font-sans bg-white w-[80mm] mx-auto text-sm leading-relaxed">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-black tracking-tight mb-1">{settings?.company_name || 'OHANA SALÓN'}</h1>
            <div className="text-xs text-gray-500 mb-3 space-y-0.5">
              {settings?.company_nif && <p>NIF: {settings.company_nif}</p>}
              {settings?.company_address && <p>{settings.company_address}</p>}
              {settings?.company_city && <p>{settings.company_postal_code} {settings.company_city}</p>}
              <p>Tel: 957 26 54 42 · 639 86 61 79</p>
            </div>
            
            <div className="bg-gray-100 py-2 rounded-md mb-2">
              <p className="font-bold text-gray-800">
                {printMode === 'gift' 
                  ? 'TICKET REGALO'
                  : (lastSale.invoice_number ? `FACTURA SIMPLIFICADA` : 'TICKET DE VENTA')
                }
              </p>
              {lastSale.invoice_number && <p className="font-mono font-semibold">{lastSale.invoice_number}</p>}
            </div>
            <p className="text-xs text-gray-500">
              {lastSale.date.toLocaleDateString()} &middot; {lastSale.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <table className="w-full mb-6">
            <thead>
              <tr className="text-left border-b-2 border-gray-200">
                <th className="py-2 text-xs text-gray-500 font-semibold w-8">Cant</th>
                <th className="py-2 text-xs text-gray-500 font-semibold">Concepto</th>
                {printMode === 'normal' && (
                  <th className="py-2 text-xs text-gray-500 font-semibold text-right">Importe</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lastSale.items.map((item, i) => (
                <tr key={i}>
                  <td className="py-2 align-top text-gray-600 font-medium">{item.quantity}</td>
                  <td className="py-2 pr-2 text-gray-800">{item.name}</td>
                  {printMode === 'normal' && (
                    <td className="py-2 text-right font-medium text-gray-800">{(item.price * item.quantity).toFixed(2)}€</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {printMode === 'gift' && (
            <div className="text-center py-4 border-y-2 border-dashed border-gray-200 my-6">
              <p className="font-bold text-gray-800 mb-1">Válido para cambios</p>
              <p className="text-xs text-gray-500">Imprescindible presentar este ticket.</p>
            </div>
          )}

          {printMode === 'normal' && (
            <>
              <div className="space-y-1 text-sm text-gray-600 mb-4">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{lastSale.subtotal.toFixed(2)}€</span>
                </div>
                {lastSale.appliedGiftCardInfo && (
                  <div className="flex justify-between text-gray-800 font-medium">
                    <span>Tarjeta Regalo ({lastSale.appliedGiftCardInfo.code})</span>
                    <span>-{lastSale.appliedGiftCardInfo.discount.toFixed(2)}€</span>
                  </div>
                )}
                {lastSale.appliedGiftCardInfo?.type === 'amount' && lastSale.appliedGiftCardInfo.remaining > 0 && (
                  <div className="flex justify-between text-xs text-gray-500 italic pl-2">
                    <span>Saldo restante en tarjeta:</span>
                    <span>{lastSale.appliedGiftCardInfo.remaining.toFixed(2)}€</span>
                  </div>
                )}
                {lastSale.pointsDiscount > 0 && (
                  <div className="flex justify-between text-gray-800 font-medium">
                    <span>Descuento Puntos ({lastSale.pointsRedeemed} pts)</span>
                    <span>-{lastSale.pointsDiscount.toFixed(2)}€</span>
                  </div>
                )}
                {lastSale.discount > 0 && (
                  <div className="flex justify-between text-red-600 font-medium">
                    <span>Descuento Manual</span>
                    <span>-{lastSale.discount.toFixed(2)}€</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-dashed border-gray-200">
                  <span>Base Imponible</span>
                  <span>{(lastSale.total / 1.21).toFixed(2)}€</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA (21%)</span>
                  <span>{(lastSale.total - (lastSale.total / 1.21)).toFixed(2)}€</span>
                </div>
              </div>

              <div className="flex justify-between items-center py-3 border-y-2 border-gray-800 mb-4">
                <span className="font-bold text-gray-800 uppercase">Total</span>
                <span className="font-black text-xl text-gray-900">{lastSale.total.toFixed(2)}€</span>
              </div>

              <div className="flex justify-between items-center text-xs text-gray-500 mb-4">
                <span>Método de pago</span>
                <span className="font-medium bg-gray-100 px-2 py-1 rounded">
                  {lastSale.paymentMethod === 'cash' ? 'Efectivo' : lastSale.paymentMethod === 'card' ? 'Tarjeta' : 'Bizum'}
                </span>
              </div>

              {/* Bloque Club de Fidelización en el Ticket */}
              {lastSale.clientName && settings?.loyalty_program_enabled && (lastSale.pointsEarned > 0 || lastSale.pointsRedeemed > 0 || lastSale.newPointsBalance !== undefined) && (
                <div className="mb-6 py-2.5 border-y border-dashed border-gray-300 text-xs text-gray-700 bg-gray-50/70 px-2 rounded">
                  <p className="font-bold text-center uppercase tracking-wider text-gray-900 mb-1.5 flex items-center justify-center gap-1">
                    ★ CLUB DE FIDELIZACIÓN ★
                  </p>
                  <div className="flex justify-between py-0.5">
                    <span>Cliente:</span>
                    <span className="font-semibold text-gray-900">{lastSale.clientName}</span>
                  </div>
                  {lastSale.pointsRedeemed > 0 && (
                    <div className="flex justify-between py-0.5 text-red-600 font-medium">
                      <span>Puntos canjeados hoy:</span>
                      <span>-{lastSale.pointsRedeemed} pts (-{lastSale.pointsDiscount.toFixed(2)}€)</span>
                    </div>
                  )}
                  {lastSale.pointsEarned > 0 && (
                    <div className="flex justify-between py-0.5 text-emerald-700 font-medium">
                      <span>Puntos acumulados hoy:</span>
                      <span>+{lastSale.pointsEarned} pts</span>
                    </div>
                  )}
                  {lastSale.newPointsBalance !== undefined && (
                    <div className="flex justify-between font-bold border-t border-gray-200 mt-1.5 pt-1 text-gray-900">
                      <span>Saldo disponible total:</span>
                      <span className="font-black text-sm">{lastSale.newPointsBalance} pts</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="text-center">
            <p className="font-bold text-gray-800 mb-1">¡Gracias por tu visita!</p>
            <p className="text-xs text-gray-400">Te esperamos pronto</p>
          </div>

          {lastSale.giftCodes && (
            <div className="mt-6 pt-4 border-t border-dashed border-gray-200 text-center">
              <p className="font-bold mb-2">¡TARJETAS REGALO!</p>
              <pre className="text-xs text-left bg-gray-100 p-2 rounded break-words whitespace-pre-wrap font-mono">
                {lastSale.giftCodes}
              </pre>
            </div>
          )}
          
          {printMode === 'normal' && lastSale.verifactu_hash && (
            <div className="mt-8 pt-4 border-t border-gray-200 text-[9px] text-gray-400 text-center">
              <p className="font-semibold mb-1 text-gray-500">CONTROL FISCAL VERIFACTU</p>
              <p className="break-all font-mono bg-gray-50 p-2 rounded">{lastSale.verifactu_hash.substring(0, 32)}...</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
