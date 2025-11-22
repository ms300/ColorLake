interface Props {
  message: string;
  hint?: string;
}

export function EmptyState({ message, hint }: Props) {
  return (
    <div className="empty-state">
      <strong>{message}</strong>
      {hint && <p>{hint}</p>}
    </div>
  );
}
