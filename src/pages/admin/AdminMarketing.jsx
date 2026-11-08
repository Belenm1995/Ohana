import { useState } from 'react'
import { Megaphone, CalendarClock } from 'lucide-react'
import MarketingCampaigns from './MarketingCampaigns'
import MarketingReminders from './MarketingReminders'
import MarketingAutomations from './MarketingAutomations'
import { Sparkles } from 'lucide-react'

export default function AdminMarketing() {
  const [activeTab, setActiveTab] = useState('campaigns')

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col h-full">
      <header className="mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-end shrink-0 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-primary" /> Marketing y Retención
          </h1>
          <p className="text-gray-500 mt-2">
            Gestiona tus campañas de WhatsApp y recordatorios automáticos de citas.
          </p>
        </div>
        
        {/* Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto self-start sm:self-end">
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'campaigns'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            }`}
          >
            <Megaphone className="w-4 h-4" /> Campañas
          </button>
          <button
            onClick={() => setActiveTab('reminders')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'reminders'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            }`}
          >
            <CalendarClock className="w-4 h-4" /> Recordatorios
          </button>
          <button
            onClick={() => setActiveTab('automations')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'automations'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            }`}
          >
            <Sparkles className="w-4 h-4" /> Automatizaciones
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'campaigns' && <MarketingCampaigns />}
        {activeTab === 'reminders' && <MarketingReminders />}
        {activeTab === 'automations' && <MarketingAutomations />}
      </div>
    </div>
  )
}
