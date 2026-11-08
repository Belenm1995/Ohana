import { useState, useEffect } from 'react'
import { Save, CreditCard, Calendar, FileText } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function AdminSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    online_payments_enabled: false,
    commissions_enabled: true,
    staff_ranking_enabled: true,
    loyalty_program_enabled: false,
    loyalty_points_per_euro: 1,
    loyalty_points_for_discount: 100,
    opening_date: '',
    company_name: '',
    company_nif: '',
    company_address: '',
    company_city: '',
    company_postal_code: '',
    verifactu_enabled: false
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .single()

      if (data) {
        setSettings({
          online_payments_enabled: data.online_payments_enabled || false,
          commissions_enabled: data.commissions_enabled ?? true,
          staff_ranking_enabled: data.staff_ranking_enabled ?? true,
          loyalty_program_enabled: data.loyalty_program_enabled ?? false,
          loyalty_points_per_euro: data.loyalty_points_per_euro ?? 1,
          loyalty_points_for_discount: data.loyalty_points_for_discount ?? 100,
          opening_date: data.opening_date || '',
          company_name: data.company_name || '',
          company_nif: data.company_nif || '',
          company_address: data.company_address || '',
          company_city: data.company_city || '',
          company_postal_code: data.company_postal_code || '',
          verifactu_enabled: data.verifactu_enabled || false
        })
      } else if (error && error.code === 'PGRST116') {
        console.log('No settings found, falling back to defaults')
      }
    } catch (err) {
      console.error('Error fetching settings:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          id: 1,
          online_payments_enabled: settings.online_payments_enabled,
          commissions_enabled: settings.commissions_enabled,
          staff_ranking_enabled: settings.staff_ranking_enabled,
          loyalty_program_enabled: settings.loyalty_program_enabled,
          loyalty_points_per_euro: settings.loyalty_points_per_euro,
          loyalty_points_for_discount: settings.loyalty_points_for_discount,
          opening_date: settings.opening_date || null,
          company_name: settings.company_name || null,
          company_nif: settings.company_nif || null,
          company_address: settings.company_address || null,
          company_city: settings.company_city || null,
          company_postal_code: settings.company_postal_code || null,
          verifactu_enabled: settings.verifactu_enabled
        })

      if (error) throw error
      alert('Configuración guardada correctamente')
    } catch (err) {
      console.error('Error saving settings:', err)
      alert('Error al guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto h-full flex flex-col">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Configuración del Sistema</h1>
        <p className="text-gray-500 mt-2">Ajustes globales de la aplicación y preferencias de negocio.</p>
      </header>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">Cargando configuración...</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1 flex flex-col min-h-0">
          <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
            <div className="space-y-8 flex-1 overflow-y-auto p-6">

              {/* Sección Datos Fiscales & VeriFactu */}
              <section>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4 border-b pb-2">
                  <FileText className="w-5 h-5 text-gray-400" /> Datos Fiscales y VeriFactu
                </h2>

                <div className="flex items-start justify-between bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-4">
                  <div>
                    <h3 className="font-semibold text-emerald-900">Activar Facturación (Ley Antifraude / VeriFactu)</h3>
                    <p className="text-sm text-emerald-700 mt-1 max-w-lg">
                      Habilita la generación de facturas encadenadas inalterables (Factura Simplificada). 
                      Los tickets generados en el TPV tendrán un número de factura (F26-XXXX) y una huella digital para cumplir la normativa.
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.verifactu_enabled}
                      onChange={(e) => setSettings({ ...settings, verifactu_enabled: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-emerald-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-emerald-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {settings.verifactu_enabled && (
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre o Razón Social</label>
                      <input
                        type="text"
                        placeholder="Ej. Ohana Beauty S.L."
                        value={settings.company_name}
                        onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">NIF / CIF</label>
                      <input
                        type="text"
                        placeholder="Ej. B12345678"
                        value={settings.company_nif}
                        onChange={(e) => setSettings({ ...settings, company_nif: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Código Postal</label>
                      <input
                        type="text"
                        placeholder="Ej. 28001"
                        value={settings.company_postal_code}
                        onChange={(e) => setSettings({ ...settings, company_postal_code: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Dirección Completa</label>
                      <input
                        type="text"
                        placeholder="Ej. Calle Mayor, 10"
                        value={settings.company_address}
                        onChange={(e) => setSettings({ ...settings, company_address: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Localidad / Provincia</label>
                      <input
                        type="text"
                        placeholder="Ej. Madrid"
                        value={settings.company_city}
                        onChange={(e) => setSettings({ ...settings, company_city: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      />
                    </div>
                  </div>
                )}
              </section>

              {/* Sección Apertura */}
              <section>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4 border-b pb-2">
                  <Calendar className="w-5 h-5 text-gray-400" /> Fecha de Apertura
                </h2>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100 gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">¿Cuándo abren las reservas?</h3>
                    <p className="text-sm text-gray-500 mt-1 max-w-lg">
                      Establece una fecha de apertura. Los clientes no podrán reservar citas antes de este día.
                      Además, esta fecha servirá como punto de partida (Semana A) para los turnos rotativos.
                    </p>
                  </div>
                  <div>
                    <input 
                      type="date" 
                      className="border border-gray-200 p-2.5 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-primary w-full sm:w-auto"
                      value={settings.opening_date}
                      onChange={(e) => setSettings({ ...settings, opening_date: e.target.value })}
                    />
                  </div>
                </div>
              </section>

              {/* Sección Pagos Online */}
              <section>
                <div className="flex items-center justify-between mb-4 border-b pb-2">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-gray-400" /> Pasarela de Pagos Online (Stripe)
                  </h2>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Modo Simulación Activo
                  </span>
                </div>

                <div className="flex items-start justify-between bg-gray-50 p-5 rounded-2xl border border-gray-100">
                  <div>
                    <h3 className="font-bold text-gray-900">Habilitar cobro con tarjeta en la web</h3>
                    <p className="text-sm text-gray-600 mt-1 max-w-xl">
                      Permite a tus clientes pagar online mediante tarjeta bancaria (Stripe) tanto en las <strong>reservas de citas</strong> como en la compra de <strong>tarjetas regalo</strong> con activación inmediata.
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 p-2.5 rounded-xl font-medium">
                      <span>💡 <strong>Modo pruebas:</strong> Puedes realizar compras y reservas de prueba usando el botón "Rellenar tarjeta de prueba" en la pasarela sin necesidad de introducir tarjetas bancarias reales ni pagar licencias.</span>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer mt-2 ml-4">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.online_payments_enabled}
                      onChange={(e) => setSettings({ ...settings, online_payments_enabled: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </section>

              {/* Sección Fidelización */}
              <section>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4 border-b pb-2">
                  <CreditCard className="w-5 h-5 text-gray-400" /> Fidelización de Clientes
                </h2>

                <div className="flex flex-col gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">Programa de Puntos</h3>
                      <p className="text-sm text-gray-500 mt-1 max-w-lg">
                        Activa el sistema de puntos para que los clientes acumulen saldo con cada compra y puedan canjearlo por descuentos.
                      </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer mt-2">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={settings.loyalty_program_enabled}
                        onChange={(e) => setSettings({ ...settings, loyalty_program_enabled: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {settings.loyalty_program_enabled && (
                    <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Puntos ganados por cada 1€ gastado
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={settings.loyalty_points_per_euro}
                          onChange={(e) => setSettings({ ...settings, loyalty_points_per_euro: parseInt(e.target.value) || 1 })}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Puntos necesarios para 1€ de descuento
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={settings.loyalty_points_for_discount}
                          onChange={(e) => setSettings({ ...settings, loyalty_points_for_discount: parseInt(e.target.value) || 100 })}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        />
                      </div>
                      <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 font-medium flex items-center gap-2">
                        <span className="font-bold">Ejemplo práctico:</span>
                        <span>
                          Por cada <strong>100€</strong> de compra, el cliente gana <strong>{100 * (settings.loyalty_points_per_euro || 1)} puntos</strong>, lo que equivale a <strong>{((100 * (settings.loyalty_points_per_euro || 1)) / (settings.loyalty_points_for_discount || 100)).toFixed(2)}€</strong> de descuento para su próxima visita.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Sección Equipo */}
              <section>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4 border-b pb-2">
                  👥 Gestión de Equipo
                </h2>

                <div className="space-y-4">
                  <div className="flex items-start justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div>
                      <h3 className="font-semibold text-gray-900">Habilitar cálculo de comisiones</h3>
                      <p className="text-sm text-gray-500 mt-1 max-w-lg">
                        Si lo desactivas, se ocultarán los campos de porcentaje de comisión en la ficha de cada empleado y en sus estadísticas, útil si prefieres no mostrar esta información al equipo.
                      </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer mt-2">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={settings.commissions_enabled}
                        onChange={(e) => setSettings({ ...settings, commissions_enabled: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="flex items-start justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div>
                      <h3 className="font-semibold text-gray-900">Mostrar "Mejor Empleado" y "Rendimiento" en Estadísticas</h3>
                      <p className="text-sm text-gray-500 mt-1 max-w-lg">
                        Si lo desactivas, se ocultará la tarjeta de Mejor Empleado y la lista de rendimiento individual en el Dashboard.
                      </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer mt-2">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={settings.staff_ranking_enabled}
                        onChange={(e) => setSettings({ ...settings, staff_ranking_enabled: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </section>

            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-end shrink-0">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-bold hover:bg-primary/90 transition-all shadow-[0_4px_12px_rgb(20,184,166,0.2)] disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
