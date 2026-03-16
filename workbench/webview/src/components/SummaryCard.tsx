import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import type { ReactNode } from 'react';

interface SummaryCardProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function SummaryCard({ title, children, footer }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium opacity-70">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer && <CardFooter className="pt-0">{footer}</CardFooter>}
    </Card>
  );
}
