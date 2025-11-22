import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { LUTMeta } from '../types';
import { LUTPreviewCanvas } from './LUTPreviewCanvas';

interface Props {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  lut: LUTMeta;
}

export function CompareSlider({ imageUrl, imageWidth, imageHeight, lut }: Props) {
  const [value, setValue] = useState(50);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const aspectStyle = imageWidth > 0 && imageHeight > 0
    ? { aspectRatio: `${imageWidth} / ${imageHeight}` }
    : undefined;

  const clampPercent = useCallback((next: number) => Math.min(100, Math.max(0, next)), []);

  const updateFromClientX = useCallback((clientX: number) => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const rect = stage.getBoundingClientRect();
    const percent = ((clientX - rect.left) / rect.width) * 100;
    setValue(clampPercent(percent));
  }, [clampPercent]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    draggingRef.current = true;
    stageRef.current?.setPointerCapture(event.pointerId);
    updateFromClientX(event.clientX);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) {
      return;
    }
    updateFromClientX(event.clientX);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) {
      return;
    }
    draggingRef.current = false;
    try {
      stageRef.current?.releasePointerCapture(event.pointerId);
    } catch (error) {
      // ignore release errors
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      setValue((prev) => clampPercent(prev - 2));
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      setValue((prev) => clampPercent(prev + 2));
    }
  };

  return (
    <div className="compare-wrapper">
      <div
        className="compare-stage"
        ref={stageRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        style={aspectStyle}
      >
        <img className="reference" src={imageUrl} alt="原图" draggable={false} />
        <div className="graded" style={{ clipPath: `inset(0 ${100 - value}% 0 0)` }}>
          <LUTPreviewCanvas imageUrl={imageUrl} lut={lut} highQuality={true} />
        </div>
        <div
          className="handle"
          style={{ left: `${value}%` }}
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(value)}
          aria-label="对比滑杆"
          onKeyDown={handleKeyDown}
        >
          <span />
        </div>
      </div>
    </div>
  );
}
