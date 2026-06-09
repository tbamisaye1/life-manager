/** Tiny hand-rolled SVG polyline sparkline. No chart library. */
export function Sparkline({ data = [], width = 120, height = 32, className }) {
  if (data.length < 2) {
    return (
      <svg width={width} height={height} className={className} aria-hidden="true">
        {data.length === 1 && (
          <circle cx={width / 2} cy={height / 2} r={3} className="fill-accent-500" />
        )}
      </svg>
    )
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 3

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2)
    const y = pad + (1 - (v - min) / range) * (height - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const lastX = parseFloat(points[points.length - 1].split(',')[0])
  const lastY = parseFloat(points[points.length - 1].split(',')[1])

  return (
    <svg width={width} height={height} className={className} aria-hidden="true">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-accent-500"
      />
      {/* Dot on last point */}
      <circle cx={lastX} cy={lastY} r={2.5} className="fill-accent-600" />
    </svg>
  )
}
