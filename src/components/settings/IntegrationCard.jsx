import { CheckCircle2, AlertCircle, RefreshCw, Plug } from 'lucide-react'
import { Card, CardBody, Button, Badge } from '../ui'
import { formatDate } from '../../lib/format'

/**
 * Connection card for an integration provider. Connect is a real browser
 * redirect to the local OAuth route; sync/disconnect are API mutations.
 */
export function IntegrationCard({ provider, status, onSync, onDisconnect, syncing, children }) {
  const { configured, connected, account, lastSyncedAt } = status

  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
              <Plug className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold capitalize text-zinc-900">{provider}</h3>
                {connected ? (
                  <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Connected</Badge>
                ) : configured ? (
                  <Badge tone="amber">Not connected</Badge>
                ) : (
                  <Badge tone="neutral"><AlertCircle className="h-3 w-3" /> Needs setup</Badge>
                )}
              </div>
              {account && <p className="mt-0.5 text-sm text-zinc-500">{account}</p>}
              {lastSyncedAt && <p className="mt-0.5 text-xs text-zinc-400">Last synced {formatDate(lastSyncedAt, 'MMM d, h:mm a')}</p>}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {connected ? (
              <>
                <Button size="sm" onClick={onSync} disabled={syncing}>
                  <RefreshCw className={syncing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Sync
                </Button>
                <Button size="sm" variant="danger" onClick={onDisconnect}>Disconnect</Button>
              </>
            ) : configured ? (
              <a href={`/api/integrations/${provider}/connect`}>
                <Button size="sm" variant="primary">Connect</Button>
              </a>
            ) : null}
          </div>
        </div>

        {children && <div className="mt-4 border-t border-zinc-100 pt-4">{children}</div>}
      </CardBody>
    </Card>
  )
}
