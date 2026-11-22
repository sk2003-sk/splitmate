import {
  Clapperboard,
  Fuel,
  HeartPulse,
  Home,
  Plane,
  Receipt,
  ShoppingBag,
  ShoppingBasket,
  UtensilsCrossed,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  UtensilsCrossed,
  ShoppingBasket,
  Plane,
  ShoppingBag,
  House: Home,
  Home,
  Zap,
  Clapperboard,
  Fuel,
  HeartPulse,
  Receipt,
};

export function CategoryIcon({
  icon,
  color,
  className,
}: {
  icon?: string;
  color?: string;
  className?: string;
}) {
  const Icon = ICONS[icon || 'Receipt'] || Receipt;
  const tint = color || '#6366f1';
  return (
    <span
      className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', className)}
      style={{ backgroundColor: `${tint}1a`, color: tint }}
    >
      <Icon className="h-[18px] w-[18px]" />
    </span>
  );
}
