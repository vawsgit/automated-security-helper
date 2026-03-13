import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';

export function AlertDemo() {
  return (
    <div className="grid max-w-xl items-start gap-4">
      <Alert>
        <AlertTitle>Success! Your changes have been saved</AlertTitle>
        <AlertDescription>
          This is an alert with title and description.
        </AlertDescription>
      </Alert>
      <Alert>
        <AlertDescription>
          This one has a description only. No title.
        </AlertDescription>
      </Alert>
      <Alert>
        <AlertTitle>Just a title, no description.</AlertTitle>
      </Alert>
      <Alert variant="destructive">
        <AlertTitle>Something went wrong!</AlertTitle>
        <AlertDescription>
          Your session has expired. Please log in again.
        </AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <AlertTitle>Unable to process your payment.</AlertTitle>
        <AlertDescription>
          <p>Please verify your billing information and try again.</p>
          <ul className="list-inside list-disc text-sm">
            <li>Check your card details</li>
            <li>Ensure sufficient funds</li>
            <li>Verify billing address</li>
          </ul>
        </AlertDescription>
      </Alert>
      <Alert className="border-amber-50 bg-amber-50 text-amber-900 dark:border-amber-950 dark:bg-amber-950 dark:text-amber-100">
        <AlertTitle>Plot Twist: This Alert is Actually Amber!</AlertTitle>
        <AlertDescription>
          This one has custom colors for light and dark mode.
        </AlertDescription>
      </Alert>
    </div>
  );
}
