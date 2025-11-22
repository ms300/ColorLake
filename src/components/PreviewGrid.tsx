import { useState, useMemo } from 'react';
import type { LUTMeta } from '../types';
import { LUTPreviewCanvas } from './LUTPreviewCanvas';
import { Pagination } from './Pagination';

interface Props {
  imageUrl: string | null;
  luts: LUTMeta[];
  selectedId: string | null;
  onSelect: (lut: LUTMeta) => void;
}

const PAGE_SIZE = 12;

export function PreviewGrid({ imageUrl, luts, selectedId, onSelect }: Props) {
  // Group by category
  const categories = useMemo(() => {
    const groups: Record<string, LUTMeta[]> = {};
    luts.forEach(lut => {
      const cat = lut.category || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(lut);
    });
    return groups;
  }, [luts]);

  // State for expanded categories and their pages
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    // Default expand all
    return {
      'Landscape': true,
      'Ricoh': true,
      'Uncategorized': true
    };
  });
  
  const [pages, setPages] = useState<Record<string, number>>({});

  const toggleExpand = (cat: string) => {
    setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const setPage = (cat: string, page: number) => {
    setPages(prev => ({ ...prev, [cat]: page }));
  };

  if (!luts.length) {
    return null;
  }

  return (
    <div className="preview-grid-container">
      {Object.entries(categories).map(([category, categoryLuts]) => {
        const isExpanded = expanded[category] ?? true;
        const page = pages[category] || 0;
        const totalPages = Math.ceil(categoryLuts.length / PAGE_SIZE);
        
        const visibleLuts = categoryLuts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

        return (
          <div key={category} className="category-section">
            <button 
              type="button"
              className="category-header" 
              onClick={() => toggleExpand(category)}
              style={{ 
                width: '100%', 
                textAlign: 'left', 
                background: 'none', 
                border: 'none', 
                color: 'inherit',
                padding: '1rem 0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '1.2rem',
                fontWeight: 'bold'
              }}
            >
               <span>{isExpanded ? '▼' : '▶'}</span>
               <span>{category}</span>
               <span style={{ opacity: 0.5, fontSize: '0.9em' }}>({categoryLuts.length})</span>
            </button>
            
            {isExpanded && (
              <>
                <div className="preview-grid">
                  {visibleLuts.map((lut) => {
                    const active = lut.id === selectedId;
                    return (
                      <button
                        key={lut.id}
                        type="button"
                        className={active ? 'preview-card active' : 'preview-card'}
                        onClick={() => onSelect(lut)}
                        disabled={!imageUrl}
                      >
                        {imageUrl ? (
                          <LUTPreviewCanvas imageUrl={imageUrl} lut={lut} />
                        ) : (
                          <span className="placeholder">上传图片后可预览</span>
                        )}
                        <span className="title">{lut.name}</span>
                      </button>
                    );
                  })}
                </div>
                {totalPages > 1 && (
                   <Pagination 
                     page={page} 
                     total={categoryLuts.length} 
                     pageSize={PAGE_SIZE}
                     onPrev={() => setPage(category, Math.max(0, page - 1))}
                     onNext={() => setPage(category, Math.min(totalPages - 1, page + 1))}
                   />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
