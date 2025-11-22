interface Props {
  page: number;
  total: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
}

export function Pagination({ page, total, pageSize, onPrev, onNext }: Props) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) {
    return null;
  }

  return (
    <div className="pagination">
      <button type="button" onClick={onPrev} disabled={page === 0}>
        上一页
      </button>
      <span>
        {page + 1} / {pages}
      </span>
      <button type="button" onClick={onNext} disabled={page + 1 >= pages}>
        下一页
      </button>
    </div>
  );
}
