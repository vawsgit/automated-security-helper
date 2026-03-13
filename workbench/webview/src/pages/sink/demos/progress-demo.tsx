import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';

export function ProgressDemo() {
  const [progress, setProgress] = useState(13);

  useEffect(() => {
    const timer = setTimeout(() => setProgress(66), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex w-full flex-col gap-4">
      <Progress value={progress} className="w-[60%]" />
      <Progress value={25} className="w-[60%]" />
      <Progress value={50} className="w-[60%]" />
      <Progress value={75} className="w-[60%]" />
      <Progress value={100} className="w-[60%]" />
    </div>
  );
}
