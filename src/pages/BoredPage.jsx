import { Link } from 'react-router-dom'
import { Sparkles, RefreshCw, ArrowRight } from 'lucide-react'
import { Button, Card, Loading, ErrorState, EmptyState } from '../components/ui'
import { useBored } from '../hooks/resources'

const KIND_LABEL = {
  improvement: 'Toward a goal',
  priority: 'Daily priority',
  project: 'Project check-in',
  email: 'Reply owed',
}

export default function BoredPage() {
  const { data, isLoading, isError, refetch, isFetching } = useBored()

  if (isLoading) return <Loading label="Thinking of something useful…" />
  if (isError) return <ErrorState message="Couldn't load suggestions" onRetry={refetch} />

  const suggestions = data?.suggestions || []
  const [primary, ...rest] = suggestions

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-100 text-accent-600">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Bored? Do this.</h1>
        <p className="mt-1 text-sm text-zinc-500">A useful, goal-aligned thing to spend the next chunk of time on.</p>
      </div>

      {!primary ? (
        <EmptyState icon={Sparkles} title="You're all caught up" description="No suggestions right now — enjoy the breather." />
      ) : (
        <>
          <Card className="bg-gradient-to-br from-accent-50 to-white p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">{KIND_LABEL[primary.kind]}</p>
            <div className="mt-2 flex items-start gap-3">
              <span className="text-3xl">{primary.emoji}</span>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-zinc-900">{primary.title}</h2>
                <p className="mt-1 text-sm text-zinc-500">{primary.context}</p>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2">
              <Link to={primary.link}>
                <Button variant="primary">Let's go <ArrowRight className="h-4 w-4" /></Button>
              </Link>
              <Button onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Something else
              </Button>
            </div>
          </Card>

          {rest.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 px-1 text-sm font-semibold text-zinc-500">Or maybe…</p>
              <div className="space-y-2">
                {rest.map((s, i) => (
                  <Link key={i} to={s.link}>
                    <Card interactive className="flex items-center gap-3 p-4">
                      <span className="text-xl">{s.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-800">{s.title}</p>
                        <p className="truncate text-xs text-zinc-400">{s.context}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-zinc-300" />
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
