import { TABLE_CELL_BASE } from '../../utils/theme-styles';

type TextAlign = 'left' | 'center' | 'right';

const TEXT_ALIGN_CLASSES: Record<TextAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

interface HeaderCellProps {
  children: React.ReactNode;
  align?: TextAlign;
  className?: string;
}

export function HeaderCell({ children, align = 'center', className = '' }: HeaderCellProps) {
  return (
    <th className={`${TABLE_CELL_BASE} ${TEXT_ALIGN_CLASSES[align]} ${className}`.trim()}>
      {children}
    </th>
  );
}
