// Categories for the "I'm Bored" list items.
export const BORED_CATEGORIES = [
  { key: 'learn', label: 'Learn', tone: 'blue' },
  { key: 'project', label: 'Project', tone: 'accent' },
  { key: 'improve', label: 'Improve', tone: 'green' },
  { key: 'fun', label: 'Fun', tone: 'amber' },
  { key: 'other', label: 'Other', tone: 'neutral' },
]

export const categoryMeta = (key) => BORED_CATEGORIES.find((c) => c.key === key) || BORED_CATEGORIES[4]
