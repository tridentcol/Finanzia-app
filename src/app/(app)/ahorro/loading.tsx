import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex flex-col gap-1">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-12 w-52" />
      </div>
      <Skeleton className="h-40 w-full rounded-[12px]" />
      <Skeleton className="h-32 w-full rounded-[12px]" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-[8px]" />
        ))}
      </div>
    </div>
  )
}
