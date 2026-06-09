import { Inbox, Pin, MessageCircle, Mail } from 'lucide-react'

// Filter definitions for the email list. Kept in a non-component module so the
// component file only exports a component (React Fast Refresh requirement).
export const EMAIL_FILTERS = [
  { key: 'all', label: 'All', icon: Inbox },
  { key: 'pinned', label: 'Pinned', icon: Pin },
  { key: 'needs_reply', label: 'Needs reply', icon: MessageCircle },
  { key: 'unread', label: 'Unread', icon: Mail },
]
