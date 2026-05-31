import { Skeleton } from '@/components/ui/skeleton'

export default function CashFlowLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      <header className="flex min-w-0 flex-col gap-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-1 h-10 w-64 sm:h-12 md:h-14" />
        <Skeleton className="mt-1 h-3 w-72" />
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-48 w-full rounded-[12px]" />
      </section>

      <section className="flex flex-col gap-3">
        <Skeleton className="h-4 w-40" />
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <li
              key={i}
              className="border-border-default bg-surface flex items-center justify-between rounded-[12px] border px-4 py-3"
            >
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
