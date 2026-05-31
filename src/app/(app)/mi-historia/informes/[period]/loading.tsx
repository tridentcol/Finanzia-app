import { Skeleton } from '@/components/ui/skeleton'

export default function InformePeriodLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-12 lg:gap-16">
      <header className="flex min-w-0 flex-col gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-72 sm:h-10 md:h-12" />
      </header>

      {/* Resumen editorial */}
      <section className="flex min-w-0 flex-col gap-1.5">
        <Skeleton className="h-3 w-full max-w-prose" />
        <Skeleton className="h-3 w-4/5 max-w-prose" />
      </section>

      {/* Métricas */}
      <section className="grid grid-cols-1 gap-px overflow-hidden rounded-[12px] border border-border-default bg-border-default sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface flex flex-col gap-2 p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-32" />
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-5">
        <Skeleton className="h-4 w-40" />
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              className="border-border-default bg-surface flex items-center justify-between rounded-[12px] border px-4 py-3"
            >
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
