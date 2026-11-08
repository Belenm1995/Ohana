import { useState } from 'react';
import { Lock, ShieldCheck, X, CreditCard, Sparkles, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';

export default function PaymentModal({
  isOpen,
  onClose,
  onSuccess,
  amount = 0,
  title = "Pago Seguro",
  description = "Completa tu pago con tarjeta",
  itemSummary = null
}) {
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardBrand, setCardBrand] = useState('visa');
  
  // Processing state: 'idle' | 'processing' | 'verifying' | 'success'
  const [paymentState, setPaymentState] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleModalClose = () => {
    setPaymentState('idle');
    setErrorMessage('');
    onClose();
  };

  if (!isOpen) return null;

  // Format Card Number (XXXX XXXX XXXX XXXX)
  const handleCardNumberChange = (e) => {
    let val = e.target.value.replace(/\D/g, '').substring(0, 16);
    // Detect brand
    if (val.startsWith('4')) setCardBrand('visa');
    else if (val.startsWith('5') || val.startsWith('2')) setCardBrand('mastercard');
    else if (val.startsWith('3')) setCardBrand('amex');
    else setCardBrand('generic');

    const formatted = val.match(/.{1,4}/g)?.join(' ') || val;
    setCardNumber(formatted);
  };

  // Format Expiry (MM/YY)
  const handleExpiryChange = (e) => {
    let val = e.target.value.replace(/\D/g, '').substring(0, 4);
    if (val.length >= 3) {
      val = val.substring(0, 2) + '/' + val.substring(2, 4);
    }
    setCardExpiry(val);
  };

  // Format CVC
  const handleCvcChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').substring(0, 4);
    setCardCvc(val);
  };

  // Autofill test card
  const handleAutofillTestCard = () => {
    setCardNumber('4242 4242 4242 4242');
    setCardHolder('Cliente Ohana');
    setCardExpiry('12/28');
    setCardCvc('123');
    setCardBrand('visa');
    setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanNum = cardNumber.replace(/\s/g, '');
    if (cleanNum.length < 15) {
      setErrorMessage('Por favor introduce un número de tarjeta válido (16 dígitos).');
      return;
    }
    if (cardExpiry.length < 5) {
      setErrorMessage('Por favor introduce la fecha de caducidad (MM/AA).');
      return;
    }
    if (cardCvc.length < 3) {
      setErrorMessage('Por favor introduce el código CVC (3 dígitos).');
      return;
    }
    if (!cardHolder.trim()) {
      setErrorMessage('Por favor introduce el nombre del titular.');
      return;
    }

    setErrorMessage('');
    setPaymentState('processing');

    // Simulate Step 1: Connecting with Stripe Gateway
    await new Promise((r) => setTimeout(r, 1200));
    setPaymentState('verifying');

    // Simulate Step 2: 3D Secure / Bank verification
    await new Promise((r) => setTimeout(r, 1500));
    setPaymentState('success');

    // Simulate Step 3: Success and callback
    await new Promise((r) => setTimeout(r, 1000));
    onSuccess({
      transactionId: 'txn_sim_' + Math.random().toString(36).substring(2, 10),
      brand: cardBrand,
      last4: cleanNum.slice(-4),
      amount: Number(amount)
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
        
        {/* Header con Badge de Seguridad */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white p-5 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight">{title}</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Modo Simulación
                </span>
              </div>
              <p className="text-xs text-gray-300 flex items-center gap-1 mt-0.5">
                <Lock className="w-3 h-3 text-emerald-400" /> Pasarela Encriptada SSL 256-bit
              </p>
            </div>
          </div>
          {paymentState === 'idle' && (
            <button
              onClick={handleModalClose}
              className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Contenido */}
        {paymentState === 'idle' && (
          <div className="p-6">
            
            {/* Resumen del importe */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 mb-6">
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Total a Pagar</span>
                <span className="text-sm font-medium text-gray-700">{itemSummary || description}</span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-gray-900">{Number(amount).toFixed(2)} €</span>
              </div>
            </div>

            {/* Tarjeta Visual Interactiva */}
            <div className="relative mb-6 rounded-2xl p-5 text-white shadow-xl overflow-hidden bg-gradient-to-tr from-slate-900 via-slate-800 to-indigo-950 border border-white/10">
              <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-7 rounded bg-amber-400/90 flex items-center justify-center shadow-inner">
                    <div className="w-7 h-5 border border-amber-600/60 rounded-sm grid grid-cols-2 gap-0.5 p-0.5">
                      <div className="border border-amber-600/40 rounded-sm"></div>
                      <div className="border border-amber-600/40 rounded-sm"></div>
                    </div>
                  </div>
                  <CreditCard className="w-5 h-5 text-gray-400" />
                </div>
                <div className="text-right">
                  <span className="text-xs uppercase font-extrabold tracking-widest text-gray-300">
                    {cardBrand.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="font-mono text-xl tracking-widest mb-4 h-7 flex items-center drop-shadow-sm">
                {cardNumber || '•••• •••• •••• ••••'}
              </div>

              <div className="flex justify-between items-end text-xs">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Titular</div>
                  <div className="font-semibold uppercase tracking-wider truncate max-w-[190px]">
                    {cardHolder || 'NOMBRE Y APELLIDOS'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">Caduca</div>
                  <div className="font-mono font-semibold">
                    {cardExpiry || 'MM/AA'}
                  </div>
                </div>
              </div>
            </div>

            {/* Botón de relleno rápido para pruebas */}
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-semibold text-gray-500">Datos de la tarjeta</span>
              <button
                type="button"
                onClick={handleAutofillTestCard}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition"
              >
                <Sparkles className="w-3.5 h-3.5" /> Rellenar tarjeta de prueba
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                {errorMessage}
              </div>
            )}

            {/* Formulario de Pago */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Número de Tarjeta</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="4242 4242 4242 4242"
                    value={cardNumber}
                    onChange={handleCardNumberChange}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 font-mono text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition"
                  />
                  <CreditCard className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Titular de la Tarjeta</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. María Pérez"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Caducidad</label>
                  <input
                    type="text"
                    required
                    placeholder="MM/AA"
                    value={cardExpiry}
                    onChange={handleExpiryChange}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 font-mono text-sm text-center focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">CVC / CVV</label>
                  <input
                    type="password"
                    required
                    maxLength={4}
                    placeholder="123"
                    value={cardCvc}
                    onChange={handleCvcChange}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 font-mono text-sm text-center focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none transition"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-4 rounded-xl bg-gray-900 text-white font-bold text-sm shadow-xl shadow-gray-900/20 hover:bg-black transition-all flex items-center justify-center gap-2 group cursor-pointer"
                >
                  <span>Pagar {Number(amount).toFixed(2)} €</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Estados de Proceso Animados */}
        {paymentState !== 'idle' && (
          <div className="p-12 text-center flex flex-col items-center justify-center min-h-[380px]">
            {paymentState === 'processing' && (
              <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 relative">
                  <Loader2 className="w-10 h-10 animate-spin" />
                  <div className="absolute inset-0 rounded-full border-2 border-indigo-600/20 animate-ping" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Conectando con la Pasarela</h3>
                <p className="text-sm text-gray-500 max-w-xs">
                  Cifrando la transacción mediante protocolos seguros de pago...
                </p>
              </div>
            )}

            {paymentState === 'verifying' && (
              <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-6">
                  <ShieldCheck className="w-10 h-10 animate-pulse" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Verificación 3D Secure</h3>
                <p className="text-sm text-gray-500 max-w-xs">
                  Autenticando con la entidad bancaria del titular...
                </p>
                <div className="mt-4 px-3 py-1 bg-gray-100 rounded-full text-[11px] font-semibold text-gray-600">
                  Respuesta bancaria: Autorizado ✓
                </div>
              </div>
            )}

            {paymentState === 'success' && (
              <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-6 shadow-inner">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-1">¡Pago Completado!</h3>
                <p className="text-sm text-emerald-600 font-semibold mb-2">
                  Transacción de {Number(amount).toFixed(2)} € confirmada
                </p>
                <p className="text-xs text-gray-400">
                  Generando tu comprobante y activando el servicio...
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
