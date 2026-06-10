import { Calendar, Plus, RefreshCw, Star, Trash2, Info } from 'lucide-react'
import { Button } from '../ui'
import { useGoogleAccounts, useGoogleCalendars, useGoogleCalendarActions } from '../../hooks/useIntegrations'

const COLOR = {
  blue: '#2563eb', violet: '#7c3aed', emerald: '#059669', amber: '#d97706',
  rose: '#e11d48', orange: '#ea580c', teal: '#0d9488', red: '#dc2626', slate: '#475569',
}

export function GoogleAccountsCard({ configured }) {
  const { data: accounts = [], isLoading: aLoading } = useGoogleAccounts()
  const { data: calendars = [] } = useGoogleCalendars()
  const { toggleCalendar, setDefault, disconnectAccount, sync } = useGoogleCalendarActions()

  const connect = () => { window.location.href = '/api/integrations/google/connect' }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-zinc-700" />
          <div>
            <h3 className="font-semibold text-zinc-900">Google Calendar</h3>
            <p className="text-sm text-zinc-500">{accounts.length ? `${accounts.length} account${accounts.length === 1 ? '' : 's'} connected` : 'Connect work, school & personal calendars'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {accounts.length > 0 && (
            <Button variant="secondary" onClick={() => sync.mutate()} disabled={sync.isPending}>
              <RefreshCw className={`h-4 w-4 ${sync.isPending ? 'animate-spin' : ''}`} /> Sync
            </Button>
          )}
          <Button variant="primary" onClick={connect} disabled={!configured}>
            <Plus className="h-4 w-4" /> Connect account
          </Button>
        </div>
      </div>

      {!configured ? (
        <div className="flex items-start gap-2 text-sm text-zinc-500">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
          <p>Add <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">GOOGLE_CLIENT_ID</code> / <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">SECRET</code> to enable Google.</p>
        </div>
      ) : aLoading ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-zinc-500">No accounts yet. Click <strong>Connect account</strong> and pick your account — repeat for each (work, school, personal).</p>
      ) : (
        <div className="space-y-4">
          {accounts.map((acc) => {
            const accCals = calendars.filter((c) => c.account_email === acc.email)
            return (
              <div key={acc.email} className="rounded-lg border border-zinc-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate font-medium text-zinc-800">{acc.email}</span>
                    {acc.is_default && (
                      <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">
                        <Star className="h-3 w-3" /> Default
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-sm">
                    {!acc.is_default && (
                      <button className="font-medium text-indigo-600 hover:underline" onClick={() => setDefault.mutate(acc.email)}>Make default</button>
                    )}
                    <button className="inline-flex items-center gap-1 font-medium text-red-600 hover:underline" onClick={() => disconnectAccount.mutate(acc.email)}>
                      <Trash2 className="h-3.5 w-3.5" /> Disconnect
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  {accCals.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={!!c.selected}
                        onChange={() => toggleCalendar.mutate({ id: c.id, selected: !c.selected })}
                        className="h-4 w-4 rounded border-zinc-300 text-indigo-600"
                      />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR[c.color] || '#2563eb' }} />
                      <span className="text-zinc-700">{c.summary}{c.is_primary ? ' · primary' : ''}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
          <p className="text-xs text-zinc-400">Unchecked calendars are hidden everywhere. The default account is where new events go unless you pick another.</p>
        </div>
      )}
    </div>
  )
}
