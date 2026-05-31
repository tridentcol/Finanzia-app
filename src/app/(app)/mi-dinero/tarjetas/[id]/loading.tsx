import { Skeleton } from '@/components/ui/skeleton'

export default function TarjetaDetailLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      <header className="flex min-w-0 flex-col gap-1.5">
        <Skeleton className="h-3 w-20" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Skeleton className="mt-1 h-8 w-48 sm:h-9" />
          <Skeleton className="h-9 w-9 rounded-[8px]" />
        </div>
        <Skeleton className="mt-2 h-10 w-64 sm:h-12 md:h-14 lg:h-16" />
        <Skeleton className="mt-1 h-3 w-40" />
      </header>

      {/* Card visual */}
      <Skeleton className="h-48 w-full max-w-sm rounded-[16px]" />

      <section className="flex flex-col gap-4">
        <Skeleton className="h-4 w-32" />
        <ul className="flex flex-col">
          {Array.from({ length: 6 }).map((_, i) => (
            <li
              key={i}
              className="border-border-default/60 flex items-center justify-between border-b py-3"
            >
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-24" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
