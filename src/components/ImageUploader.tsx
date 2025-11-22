import { ChangeEvent } from 'react';

interface Props {
  onFilesAccepted: (files: File[]) => void | Promise<void>;
  busy?: boolean;
}

export function ImageUploader({ onFilesAccepted, busy = false }: Props) {
  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files;
    if (!list) {
      return;
    }
    const files = Array.from(list).filter((file) => file.type.startsWith('image/'));
    if (files.length) {
      await onFilesAccepted(files);
    }
    event.target.value = '';
  };

  return (
    <label className={`uploader${busy ? ' busy' : ''}`} aria-busy={busy}>
      <input type="file" accept="image/*" multiple onChange={handleChange} disabled={busy} />
      <div>
        <strong>{busy ? '正在处理图片…' : '批量上传图片'}</strong>
        <p>{busy ? '正在生成缩略图，请稍候' : '支持拖入多张照片，或点击这里选择文件。'}</p>
      </div>
    </label>
  );
}
