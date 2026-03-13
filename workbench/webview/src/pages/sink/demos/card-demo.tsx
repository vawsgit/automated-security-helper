import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function CardDemo() {
  return (
    <div className="flex flex-col items-start gap-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Scan Configuration</CardTitle>
          <CardDescription>
            Configure your next security scan
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          Select a source directory and scanner configuration to begin
          analyzing your project for security findings.
        </CardContent>
        <CardFooter className="flex-col gap-2">
          <Button type="submit" className="w-full">Start Scan</Button>
          <Button variant="outline" className="w-full">Cancel</Button>
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Meeting Notes</CardTitle>
          <CardDescription>
            Transcript from the security review meeting.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <p>Team reviewed latest scan results and agreed on triage workflow.</p>
          <ol className="mt-4 flex list-decimal flex-col gap-2 pl-6">
            <li>All CRITICAL findings must be fixed within 48 hours</li>
            <li>HIGH findings require owner assignment by EOD</li>
            <li>MEDIUM/LOW findings triaged in weekly review</li>
            <li>Suppressions require justification comments</li>
            <li>Follow-up scan scheduled for next sprint</li>
          </ol>
        </CardContent>
      </Card>
      <div className="flex w-full flex-wrap items-start gap-4">
        <Card>
          <CardContent className="text-sm">Content Only</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Header Only</CardTitle>
            <CardDescription>A card with header and description.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Header + Content</CardTitle>
            <CardDescription>A card with header and content.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">Content</CardContent>
        </Card>
        <Card>
          <CardFooter className="text-sm">Footer Only</CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Header + Footer</CardTitle>
            <CardDescription>A card with header and footer.</CardDescription>
          </CardHeader>
          <CardFooter className="text-sm">Footer</CardFooter>
        </Card>
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Header with Border</CardTitle>
            <CardDescription>Bottom border on header.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">Content</CardContent>
        </Card>
        <Card>
          <CardContent className="text-sm">Content</CardContent>
          <CardFooter className="border-t text-sm">Footer with Border</CardFooter>
        </Card>
      </div>
    </div>
  );
}
