import { HistoryContainer } from './history-container'

export function Sidebar() {
  return (
    <div className="fixed top-16 right-0 z-50 hidden h-[calc(100vh-4rem)] w-64 shrink-0 lg:block">
      <div className="h-full overflow-hidden border-l bg-background">
        <div className="flex h-16 items-center gap-2 border-b px-4">
          <div className="text-sm font-medium">History</div>
        </div>
        <div className="h-[calc(100vh-8rem)] overflow-hidden">
          <HistoryContainer />
        </div>
      </div>
    </div>
  )
}
