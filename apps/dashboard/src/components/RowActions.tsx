import { Pencil, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '../lib/cn';

interface Props {
  onEdit?: () => void;
  onDelete?: () => void;
  disabled?: boolean;
  compact?: boolean;
}

export function RowActions({ onEdit, onDelete, disabled, compact }: Props) {
  return (
    <div
      className={cn('flex flex-wrap items-center justify-end gap-1.5', compact && 'gap-1')}
      onClick={(e) => e.stopPropagation()}
    >
      {onEdit && (
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onEdit}
          className="border-blue-800/60 text-blue-300 hover:bg-blue-950/50 hover:text-blue-200"
        >
          <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
          {!compact && <span>Edit</span>}
        </Button>
      )}
      {onDelete && (
        <Button variant="danger" size="sm" disabled={disabled} onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          {!compact && <span>Delete</span>}
        </Button>
      )}
    </div>
  );
}
