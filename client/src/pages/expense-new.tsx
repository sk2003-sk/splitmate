import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { ExpenseForm } from '@/components/expense-form';

export default function ExpenseNewPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const groupId = params.get('groupId');

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="New expense"
        title="Add an expense"
        description="Pick who paid, who shares it and how. SplitMate validates the split and stores exact paise on the server."
        actions={
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        }
      />
      <ExpenseForm
        defaultGroupId={groupId}
        onCancel={() => navigate(-1)}
        onSaved={(expense) => navigate(`/expenses/${expense._id}`)}
      />
    </div>
  );
}
