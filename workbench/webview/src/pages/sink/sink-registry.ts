import type { ComponentType } from 'react';
import { AccordionDemo } from './demos/accordion-demo';
import { AlertDemo } from './demos/alert-demo';
import { BadgeDemo } from './demos/badge-demo';
import { ButtonDemo } from './demos/button-demo';
import { CardDemo } from './demos/card-demo';
import { CheckboxDemo } from './demos/checkbox-demo';
import { DialogDemo } from './demos/dialog-demo';
import { DropdownMenuDemo } from './demos/dropdown-menu-demo';
import { InputDemo } from './demos/input-demo';
import { LabelDemo } from './demos/label-demo';
import { ProgressDemo } from './demos/progress-demo';
import { SelectDemo } from './demos/select-demo';
import { SeparatorDemo } from './demos/separator-demo';
import { SkeletonDemo } from './demos/skeleton-demo';
import { SwitchDemo } from './demos/switch-demo';
import { TableDemo } from './demos/table-demo';
import { TabsDemo } from './demos/tabs-demo';
import { TextareaDemo } from './demos/textarea-demo';
import { TooltipDemo } from './demos/tooltip-demo';
import { SeverityBadgeDemo } from './demos/severity-badge-demo';
import { DispositionBadgeDemo } from './demos/disposition-badge-demo';
import { TasksDemo } from './demos/tasks-demo';
import { SuppressionFormDemo } from './demos/suppression-form-demo';
import { SuppressionManagementDemo } from './demos/suppression-management-demo';
import { AiAnalysisDemo } from './demos/ai-analysis-demo';

export type SinkComponentConfig = {
  name: string;
  component: ComponentType;
  className?: string;
  type: 'ui' | 'app';
  label?: string;
};

export const sinkRegistry: Record<string, SinkComponentConfig> = {
  accordion: { name: 'Accordion', component: AccordionDemo, type: 'ui' },
  alert: { name: 'Alert', component: AlertDemo, type: 'ui' },
  badge: { name: 'Badge', component: BadgeDemo, type: 'ui' },
  button: { name: 'Button', component: ButtonDemo, type: 'ui' },
  card: { name: 'Card', component: CardDemo, type: 'ui' },
  checkbox: { name: 'Checkbox', component: CheckboxDemo, type: 'ui' },
  dialog: { name: 'Dialog', component: DialogDemo, type: 'ui' },
  'dropdown-menu': { name: 'Dropdown Menu', component: DropdownMenuDemo, type: 'ui' },
  input: { name: 'Input', component: InputDemo, type: 'ui' },
  label: { name: 'Label', component: LabelDemo, type: 'ui' },
  progress: { name: 'Progress', component: ProgressDemo, type: 'ui' },
  select: { name: 'Select', component: SelectDemo, type: 'ui' },
  separator: { name: 'Separator', component: SeparatorDemo, type: 'ui' },
  skeleton: { name: 'Skeleton', component: SkeletonDemo, type: 'ui' },
  switch: { name: 'Switch', component: SwitchDemo, type: 'ui' },
  table: { name: 'Table', component: TableDemo, type: 'ui' },
  tabs: { name: 'Tabs', component: TabsDemo, type: 'ui' },
  textarea: { name: 'Textarea', component: TextareaDemo, type: 'ui' },
  tooltip: { name: 'Tooltip', component: TooltipDemo, type: 'ui' },
  'severity-badge': { name: 'Severity Badge', component: SeverityBadgeDemo, type: 'app' },
  'disposition-badge': { name: 'Disposition Badge', component: DispositionBadgeDemo, type: 'app' },
  tasks: { name: 'Tasks', component: TasksDemo, type: 'app', className: 'w-full' },
  'suppression-form': { name: 'Suppression Form', component: SuppressionFormDemo, type: 'app', className: 'w-full' },
  'suppression-management': { name: 'Suppression Management', component: SuppressionManagementDemo, type: 'app', className: 'w-full' },
  'ai-analysis': { name: 'AI Analysis', component: AiAnalysisDemo, type: 'app', className: 'w-full' },
};
