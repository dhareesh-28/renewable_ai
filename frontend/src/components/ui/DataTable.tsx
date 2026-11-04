import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (row: T, index: number) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField?: keyof T;
  className?: string;
  dense?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  className = '',
  dense = true,
  emptyMessage = 'No records available.',
  onRowClick,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        setSortKey(null);
        setSortDir('asc');
      }
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];

      if (valA == null) return 1;
      if (valB == null) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA);
      const strB = String(valB);
      return sortDir === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [data, sortKey, sortDir]);

  const cellPadding = dense ? 'py-2 px-3.5 text-[13px]' : 'py-3 px-4 text-ui';

  return (
    <div
      className={`w-full overflow-x-auto max-h-[480px] overflow-y-auto border border-hairline rounded-control bg-raised ${className}`}
    >
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-surface/95 backdrop-blur-[4px] z-10 border-b border-hairline">
          <tr>
            {columns.map((col) => {
              const isSorted = sortKey === col.key;
              const isSortable = col.sortable !== false;
              const alignClass =
                col.align === 'right'
                  ? 'text-right justify-end'
                  : col.align === 'center'
                  ? 'text-center justify-center'
                  : 'text-left justify-start';

              return (
                <th
                  key={col.key}
                  onClick={() => isSortable && handleSort(col.key)}
                  className={`py-2.5 px-3.5 font-normal text-[11px] uppercase tracking-label text-muted select-none ${
                    isSortable ? 'cursor-pointer hover:text-ink transition-colors' : ''
                  }`}
                >
                  <div className={`inline-flex items-center gap-1.5 ${alignClass} w-full`}>
                    <span>{col.header}</span>
                    {isSortable && (
                      <span className="text-muted/60">
                        {isSorted ? (
                          sortDir === 'asc' ? (
                            <ArrowUp size={11} className="text-ink" />
                          ) : (
                            <ArrowDown size={11} className="text-ink" />
                          )
                        ) : (
                          <ArrowUpDown size={11} />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline/60">
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-8 text-center text-muted font-sans text-caption">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedData.map((row, idx) => {
              const rowKey = keyField ? String(row[keyField]) : idx;
              return (
                <tr
                  key={rowKey}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`transition-colors duration-150 ${
                    onRowClick
                      ? 'cursor-pointer hover:bg-surface active:bg-surface/80'
                      : 'hover:bg-surface/50'
                  }`}
                >
                  {columns.map((col) => {
                    const alignClass =
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left';

                    const val = row[col.key];
                    const content = col.render ? col.render(row, idx) : (val as React.ReactNode);

                    return (
                      <td
                        key={col.key}
                        className={`${cellPadding} text-ink tabular-nums ${alignClass}`}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
