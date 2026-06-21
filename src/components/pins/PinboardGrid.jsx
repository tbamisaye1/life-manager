import { Pin } from 'lucide-react'
import { PinTile } from './PinTile'
import { BUCKET_LABELS, BUCKET_ORDER } from '../../lib/pinUtils'

function BucketSection({ label, pins, ...handlers }) {
  if (!pins.length) return null
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">{label}</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(148px,1fr))] sm:gap-3">
        {pins.map((pin) => (
          <PinTile key={pin.id} pin={pin} {...handlers} />
        ))}
      </div>
    </section>
  )
}

/** Mosaic glance board — pinned strip + time-bucketed grid. */
export function PinboardGrid({ pinned, buckets, ...handlers }) {
  const hasContent = pinned.length > 0 || BUCKET_ORDER.some((k) => buckets[k]?.length)

  if (!hasContent) return null

  return (
    <div>
      {pinned.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <Pin className="h-3.5 w-3.5 text-indigo-500" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Pinned · {pinned.length}
            </h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {pinned.map((pin) => (
              <PinTile key={pin.id} pin={pin} compact {...handlers} />
            ))}
          </div>
        </section>
      )}

      {BUCKET_ORDER.map((key) => (
        <BucketSection
          key={key}
          label={BUCKET_LABELS[key]}
          pins={buckets[key] || []}
          {...handlers}
        />
      ))}
    </div>
  )
}
