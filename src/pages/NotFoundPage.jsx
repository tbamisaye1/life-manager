import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button, EmptyState } from '../components/ui'

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-16">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="That route doesn't exist yet."
        action={<Link to="/today"><Button variant="primary">Back to Today</Button></Link>}
      />
    </div>
  )
}
