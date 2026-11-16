import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { UserMinus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Toggle button for a relay feed's "discovery mode": when active, notes
 * authored by people the current account already follows are hidden, so
 * the feed only surfaces new authors. The on/off state is owned (and
 * persisted per feed) by the parent feed component.
 */
export default function HideFollowedFilter({
  active,
  onToggle
}: {
  active: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const label = t('Hide followed users')

  return (
    <Button
      variant="ghost"
      size="titlebar-icon"
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        active
          ? 'text-primary hover:text-primary-hover'
          : 'text-muted-foreground hover:text-foreground'
      )}
      onClick={onToggle}
    >
      <UserMinus size={16} />
    </Button>
  )
}
