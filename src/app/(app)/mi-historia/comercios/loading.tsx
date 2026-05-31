import { Skeleton } from '@/components/ui/skeleton'

export default function ComerciosLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      <header className="flex min-w-0 flex-col gap-1.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-1 h-9 w-72 sm:h-10" />
        <Skeleton className="mt-1 h-3 w-80 max-w-full" />
      </header>

      {/* Selector de período */}
      <Skeleton className="h-9 w-64 self-start rounded-[8px]" />

      <ul className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <li
            key={i}
            className="border-border-default bg-surface flex items-center justify-between rounded-[12px] border px-4 py-3"
          >
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-4 w-24" />
          </li>
        ))}
      </ul>
    </div>
  )
}
