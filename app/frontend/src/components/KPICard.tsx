import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  icon?: LucideIcon
  color?: 'blue' | 'orange' | 'green' | 'red' | 'teal' | 'purple'
  className?: string
}

const colorMap = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'text-blue-500',
    badge: 'bg-blue-100 text-blue-700',
    border: 'border-blue-100',
  },
  orange: {
    bg: 'bg-orange-50',
    icon: 'text-orange-500',
    badge: 'bg-orange-100 text-orange-700',
    border: 'border-orange-100',
  },
  green: {
    bg: 'bg-green-50',
    icon: 'text-green-500',
    badge: 'bg-green-100 text-green-700',
    border: 'border-green-100',
  },
  red: {
    bg: 'bg-red-50',
    icon: 'text-red-500',
    badge: 'bg-red-100 text-red-700',
    border: 'border-red-100',
  },
  teal: {
    bg: 'bg-cyan-50',
    icon: 'text-cyan-500',
    badge: 'bg-cyan-100 text-cyan-700',
    border: 'border-cyan-100',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'text-purple-500',
    badge: 'bg-purple-100 text-purple-700',
    border: 'border-purple-100',
  },
}

export default function KPICard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon: Icon,
  color = 'blue',
  className,
}: KPICardProps) {
  const colors = colorMap[color]

  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  const trendColor =
    trend === 'up'
      ? 'text-green-600'
      : trend === 'down'
      ? 'text-red-500'
      : 'text-gray-400'

  return (
    <div
      className={clsx(
        'bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-start gap-4',
        className
      )}
    >
      {Icon && (
        <div className={clsx('p-2.5 rounded-xl flex-shrink-0', colors.bg)}>
          <Icon size={20} className={colors.icon} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 truncate">{title}</p>
        <p className="text-2xl font-bold text-[#1B2559] mt-0.5 leading-tight">{value}</p>
        {(subtitle || trendValue) && (
          <div className="flex items-center gap-2 mt-1">
            {trendValue && (
              <span className={clsx('flex items-center gap-0.5 text-xs font-medium', trendColor)}>
                <TrendIcon size={12} />
                {trendValue}
              </span>
            )}
            {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
