import type { UploadedImage } from '../types';

interface Props {
  items: UploadedImage[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function ImageSelector({ items, activeId, onSelect }: Props) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="image-selector">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={item.id === activeId ? 'thumb active' : 'thumb'}
          onClick={() => onSelect(item.id)}
        >
          <img src={item.previewUrl} alt={item.name} />
          <span>{item.name}</span>
        </button>
      ))}
    </div>
  );
}
