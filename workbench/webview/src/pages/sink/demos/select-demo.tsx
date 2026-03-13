import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function SelectDemo() {
  return (
    <div className="flex flex-wrap items-start gap-4">
      <Select>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select a scanner" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Scanners</SelectLabel>
            <SelectItem value="bandit">Bandit</SelectItem>
            <SelectItem value="checkov">Checkov</SelectItem>
            <SelectItem value="semgrep">Semgrep</SelectItem>
            <SelectItem value="grype" disabled>Grype</SelectItem>
            <SelectItem value="npm-audit">npm-audit</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Large List" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 50 }).map((_, i) => (
            <SelectItem key={i} value={`item-${i}`}>
              Item {i}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select disabled>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Disabled" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
