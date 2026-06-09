// Platform metadata for the reply queue (manual stand-in for messaging apps).
export const PLATFORMS = {
  imessage: { label: 'iMessage', cls: 'bg-green-100 text-green-700' },
  whatsapp: { label: 'WhatsApp', cls: 'bg-emerald-100 text-emerald-700' },
  instagram: { label: 'Instagram', cls: 'bg-pink-100 text-pink-700' },
  snapchat: { label: 'Snapchat', cls: 'bg-yellow-100 text-yellow-700' },
  email: { label: 'Email', cls: 'bg-blue-100 text-blue-700' },
  other: { label: 'Other', cls: 'bg-zinc-100 text-zinc-600' },
}

export const PLATFORM_KEYS = Object.keys(PLATFORMS)
export const platformMeta = (key) => PLATFORMS[key] || PLATFORMS.other
