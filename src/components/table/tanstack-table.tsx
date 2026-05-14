'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  type Cell,
  type Header,
  type Row,
  type Table as TanStackTable,
  flexRender,
} from '@tanstack/react-table';

type TanStackDataTableProps<TData> = {
  table: TanStackTable<TData>;
  className?: string;
  headerClassName?: (header: Header<TData, unknown>) => string | undefined;
  cellClassName?: (cell: Cell<TData, unknown>) => string | undefined;
  colClassName?: (columnId: string) => string | undefined;
  rowClassName?: (row: Row<TData>) => string | undefined;
  onRowDoubleClick?: (row: Row<TData>) => void;
};

export function TanStackDataTable<TData>({
  table,
  className,
  headerClassName,
  cellClassName,
  colClassName,
  rowClassName,
  onRowDoubleClick,
}: TanStackDataTableProps<TData>) {
  const columns = table.getAllLeafColumns();

  return (
    <Table className={className}>
      {colClassName && (
        <colgroup>
          {columns.map((column) => (
            <col key={column.id} className={colClassName(column.id)} />
          ))}
        </colgroup>
      )}
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                className={cn(headerClassName?.(header))}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            className={cn(rowClassName?.(row))}
            onDoubleClick={
              onRowDoubleClick ? () => onRowDoubleClick(row) : undefined
            }
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id} className={cn(cellClassName?.(cell))}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
