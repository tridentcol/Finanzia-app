import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="flex flex-col gap-8 max-w-lg">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full rounded-[12px]" />
        <Skeleton className="h-20 w-full rounded-[12px]" />
      </div>
    </div>
  )
}
