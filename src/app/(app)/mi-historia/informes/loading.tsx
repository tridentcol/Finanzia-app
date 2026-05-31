import { Skeleton } from '@/components/ui/skeleton'

export default function InformesLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      <header className="flex min-w-0 flex-col gap-1.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-1 h-9 w-72 sm:h-10" />
        <Skeleton className="mt-1 h-3 w-80 max-w-full" />
      </header>

      <section className="flex min-w-0 flex-col gap-4">
        <div className="border-border-default/60 flex items-baseline justify-between border-b pb-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <ul className="flex flex-col">
          {Array.from({ length: 6 }).map((_, i) => (
            <li
              key={i}
              className="border-border-default/60 flex items-center justify-between border-b py-4"
            >
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-32" />
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
