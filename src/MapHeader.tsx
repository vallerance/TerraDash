import type { ReactNode } from 'react';

type MapHeaderProps = {
  children: ReactNode;
  overlay?: ReactNode;
};

export function MapHeader({ children, overlay }: MapHeaderProps) {
  return (
    <div className="quiz-header">
      {children}
      {overlay}
    </div>
  );
}
