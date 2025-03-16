import { Skeleton } from './ui/skeleton'

export function HistorySkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-0">
        <div className="space-y-2 py-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start p-2 border rounded">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-[80%]" />
                <Skeleton className="h-3 w-[40%]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
