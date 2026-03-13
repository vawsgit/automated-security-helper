import { Button } from '@/components/ui/button';

export function ButtonDemo() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm">Small</Button>
        <Button variant="outline" size="sm">Outline</Button>
        <Button variant="ghost" size="sm">Ghost</Button>
        <Button variant="destructive" size="sm">Destructive</Button>
        <Button variant="secondary" size="sm">Secondary</Button>
        <Button variant="link" size="sm">Link</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button>Button</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="link">Link</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="lg">Large</Button>
        <Button variant="outline" size="lg">Outline</Button>
        <Button variant="ghost" size="lg">Ghost</Button>
        <Button variant="destructive" size="lg">Destructive</Button>
        <Button variant="secondary" size="lg">Secondary</Button>
        <Button variant="link" size="lg">Link</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon" variant="outline" aria-label="Add">+</Button>
        <Button size="icon" variant="outline" aria-label="Close">&times;</Button>
        <Button size="icon" variant="ghost" aria-label="More">&hellip;</Button>
        <Button disabled variant="outline">Please wait</Button>
      </div>
    </div>
  );
}
