import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Settings, ShieldCheck, Info } from 'lucide-react'
import { NavPageHeader, Button, Input, Label, Loading, ErrorState } from '../components/ui'
import { IntegrationCard } from '../components/settings/IntegrationCard'
import { GoogleAccountsCard } from '../components/settings/GoogleAccountsCard'
import { MicrosoftAccountsCard } from '../components/settings/MicrosoftAccountsCard'
import { useIntegrationStatus, useSyncProvider, useDisconnectProvider } from '../hooks/useIntegrations'

export default function SettingsPage() {
  const { data, isLoading, isError, refetch } = useIntegrationStatus()
  const sync = useSyncProvider()
  const disconnect = useDisconnectProvider()
  const [params] = useSearchParams()
  const [notionDb, setNotionDb] = useState('')

  if (isLoading) return <Loading label="Loading settings…" />
  if (isError) return <ErrorState message="Couldn't load settings" onRetry={refetch} />

  const justConnected = params.get('connected')

  return (
    <div className="mx-auto max-w-2xl">
      <NavPageHeader path="/settings" subtitle="Connect your accounts. Everything stays on your machine." icon={Settings} />

      {justConnected && (
        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          ✅ Connected {justConnected}. Your data is syncing in.
        </div>
      )}

      <div className="mb-5 flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <p>This app uses a <strong>local database only</strong> — no cloud, no AWS. Connecting an account stores tokens locally and never touches any other system.</p>
      </div>

      <div className="space-y-4">
        <GoogleAccountsCard configured={data.google?.configured} />
        <MicrosoftAccountsCard configured={data.microsoft?.configured} />

        <IntegrationCard
          provider="notion"
          status={data.notion}
          syncing={sync.isPending}
          onSync={() => sync.mutate({ provider: 'notion', databaseId: notionDb })}
          onDisconnect={() => disconnect.mutate('notion')}
        >
          {data.notion.connected ? (
            <div>
              <Label>Notion database ID to sync tasks from</Label>
              <div className="flex gap-2">
                <Input value={notionDb} onChange={(e) => setNotionDb(e.target.value)} placeholder="Paste the database ID from its URL" />
                <Button variant="primary" onClick={() => sync.mutate({ provider: 'notion', databaseId: notionDb })} disabled={!notionDb || sync.isPending}>
                  Sync tasks
                </Button>
              </div>
            </div>
          ) : !data.notion.configured ? (
            <SetupHint provider="Notion" />
          ) : null}
        </IntegrationCard>
      </div>
    </div>
  )
}

function SetupHint({ provider }) {
  return (
    <div className="flex items-start gap-2 text-sm text-zinc-500">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
      <p>
        Add your {provider} OAuth credentials to <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">.env</code> (see
        {' '}<code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">.env.example</code> and <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">SETUP.md</code>), then restart the server. Until then the app runs on local data.
      </p>
    </div>
  )
}
