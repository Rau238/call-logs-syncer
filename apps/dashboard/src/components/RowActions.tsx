interface Props {
  onEdit?: () => void;
  onDelete?: () => void;
  disabled?: boolean;
  compact?: boolean;
}

export function RowActions({ onEdit, onDelete, disabled, compact }: Props) {
  return (
    <div
      className={`row-actions ${compact ? 'row-actions-compact' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      {onEdit && (
        <button
          type="button"
          className="btn-edit-sm"
          disabled={disabled}
          onClick={onEdit}
        >
          Edit
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          className="btn-danger-sm"
          disabled={disabled}
          onClick={onDelete}
        >
          Delete
        </button>
      )}
    </div>
  );
}
