import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn, initialsOf } from '@/lib/utils';

interface AvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  name?: string;
  color?: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
  xl: 'h-16 w-16 text-lg',
};

export function Avatar({ className, name, color, src, size = 'md', ...props }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full ring-2 ring-background',
        sizeMap[size],
        className,
      )}
      {...props}
    >
      {src ? (
        <AvatarPrimitive.Image src={src} alt={name || 'Member'} className="h-full w-full object-cover" />
      ) : null}
      <AvatarPrimitive.Fallback
        className="flex h-full w-full items-center justify-center font-bold"
        style={{
          backgroundColor: `${color || '#6366f1'}20`,
          color: color || '#6366f1',
        }}
        delayMs={src ? 300 : 0}
      >
        {initialsOf(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export function AvatarStack({ users, max = 4 }: { users: { _id: string; name: string; avatarColor: string; avatarUrl?: string }[]; max?: number }) {
  const visible = users.slice(0, max);
  const rest = users.length - visible.length;
  return (
    <div className="flex items-center -space-x-2">
      {visible.map((user) => (
        <Avatar
          key={user._id}
          name={user.name}
          color={user.avatarColor}
          src={user.avatarUrl || undefined}
          size="sm"
          className="ring-background"
        />
      ))}
      {rest > 0 ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background">
          +{rest}
        </span>
      ) : null}
    </div>
  );
}
