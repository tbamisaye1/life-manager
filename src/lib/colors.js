// Central color map so projects, events, and badges render consistently.
// Each entry provides matching soft background, text, and dot classes.
const PALETTE = {
  slate: { soft: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400', ring: 'ring-slate-200' },
  violet: { soft: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500', ring: 'ring-violet-200' },
  blue: { soft: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', ring: 'ring-blue-200' },
  emerald: { soft: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', ring: 'ring-emerald-200' },
  amber: { soft: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', ring: 'ring-amber-200' },
  rose: { soft: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500', ring: 'ring-rose-200' },
  orange: { soft: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', ring: 'ring-orange-200' },
  teal: { soft: 'bg-teal-100 text-teal-700', dot: 'bg-teal-500', ring: 'ring-teal-200' },
  red: { soft: 'bg-red-100 text-red-700', dot: 'bg-red-500', ring: 'ring-red-200' },
}

export const PROJECT_COLORS = Object.keys(PALETTE)

export function colorClasses(name) {
  return PALETTE[name] || PALETTE.slate
}
