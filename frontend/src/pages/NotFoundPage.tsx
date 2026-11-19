import { Link } from 'react-router'
import { EmptyState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="container-page pt-36">
      <EmptyState title="This trail goes nowhere" message="We couldn’t find that page."
        action={<Button asChild><Link to="/">Back home</Link></Button>} />
    </div>
  )
}
