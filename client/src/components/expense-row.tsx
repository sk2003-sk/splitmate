import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Avatar } from '@/components/ui/avatar';
import { CategoryIcon } from '@/components/category-icon';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatMoney, person } from '@/lib/utils';
import type { Expense } from '@/types';

export function ExpenseRow({ expense, index = 0 }: { expense: Expense; index?: number }) {
  const navigate = useNavigate();
  const category = typeof expense.category === 'object' ? expense.category : null;
  const group = expense.group && typeof expense.group === 'object' ? expense.group : null;
  const payer = expense.paidBy?.[0] ? person(expense.paidBy[0].user) : null;
  const myShare = expense.mySharePaise ?? 0;

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
      onClick={() => navigate(`/expenses/${expense._id}`)}
      className="group flex w-full items-center gap-3 rounded-xl border border-transparent px-2 py-3 text-left transition hover:border-border hover:bg-card hover:shadow-soft sm:gap-4 sm:px-3"
    >
      <CategoryIcon icon={category?.icon} color={category?.color} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{expense.description}</p>
          {group ? (
            <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">
              {group.emoji} {group.name}
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
          {payer ? (
            <>
              <Avatar name={payer.name} color={payer.avatarColor} src={payer.avatarUrl} size="sm" className="mr-1 h-4 w-4 ring-0" />
              Paid by {payer.name}
            </>
          ) : (
            'Payment recorded'
          )}
          <span className="text-border">•</span>
          {formatDate(expense.date)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums">{formatMoney(expense.amountPaise)}</p>
        {myShare > 0 ? (
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
            Your share {formatMoney(myShare)}
          </p>
        ) : null}
      </div>
      <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:text-muted-foreground sm:block" />
    </motion.button>
  );
}
