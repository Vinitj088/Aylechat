"use client"

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle2, XCircle, Pause, Play, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// --- Task Execution Panel Component ---
// Displays multi-step task execution progress

export type TaskStep = {
  id: string
  description: string
  action: 'search' | 'scrape' | 'analyze' | 'generate' | 'tool_call'
  toolCommand?: string
  dependencies: string[]
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  result?: string
  error?: string
}

export type TaskPlan = {
  id: string
  originalQuery: string
  steps: TaskStep[]
  currentStepIndex: number
  status: 'planning' | 'executing' | 'completed' | 'failed'
  createdAt: Date
}

interface TaskExecutionPanelProps {
  plan: TaskPlan
  onPause?: () => void
  onResume?: () => void
  onCancel?: () => void
  onStepComplete?: (stepId: string, result: string) => void
}

const TaskExecutionPanel: React.FC<TaskExecutionPanelProps> = ({
  plan,
  onPause,
  onResume,
  onCancel,
  onStepComplete,
}) => {
  const [isPaused, setIsPaused] = useState(false)

  const handlePause = () => {
    setIsPaused(true)
    onPause?.()
  }

  const handleResume = () => {
    setIsPaused(false)
    onResume?.()
  }

  const handleCancel = () => {
    onCancel?.()
  }

  // Calculate progress
  const completedSteps = plan.steps.filter(s => s.status === 'completed').length
  const totalSteps = plan.steps.length
  const progressPercent = (completedSteps / totalSteps) * 100

  // Get status icon and color
  const getStepStatusIcon = (status: TaskStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'in_progress':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
    }
  }

  const getActionEmoji = (action: TaskStep['action']) => {
    switch (action) {
      case 'search':
        return '🔍'
      case 'scrape':
        return '🌐'
      case 'analyze':
        return '🧠'
      case 'generate':
        return '✨'
      case 'tool_call':
        return '🛠️'
      default:
        return '📝'
    }
  }

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-900 shadow-lg max-w-2xl mx-auto my-4">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            🤖 Autonomous Task Execution
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="text-gray-500 hover:text-red-500"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {plan.originalQuery}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Progress: {completedSteps}/{totalSteps} steps
          </span>
          <span className="text-sm text-gray-500">
            {Math.round(progressPercent)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={cn(
              'h-2 rounded-full transition-all duration-300',
              plan.status === 'failed'
                ? 'bg-red-500'
                : plan.status === 'completed'
                ? 'bg-green-500'
                : 'bg-blue-500'
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Steps List */}
      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
        {plan.steps.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              'p-3 rounded-lg border transition-all',
              step.status === 'in_progress'
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                : step.status === 'completed'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : step.status === 'failed'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
            )}
          >
            <div className="flex items-start gap-3">
              {/* Status Icon */}
              <div className="mt-0.5">{getStepStatusIcon(step.status)}</div>

              {/* Step Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">
                    {getActionEmoji(step.action)}
                  </span>
                  <span className="font-medium text-sm">
                    Step {index + 1}: {step.description}
                  </span>
                </div>

                {/* Action Type */}
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Action: {step.action}
                  {step.toolCommand && ` (${step.toolCommand})`}
                </div>

                {/* Dependencies */}
                {step.dependencies.length > 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Depends on: {step.dependencies.join(', ')}
                  </div>
                )}

                {/* Result Preview (if completed) */}
                {step.status === 'completed' && step.result && (
                  <div className="mt-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 p-2 rounded border">
                    {step.result.length > 100
                      ? step.result.substring(0, 100) + '...'
                      : step.result}
                  </div>
                )}

                {/* Error (if failed) */}
                {step.status === 'failed' && step.error && (
                  <div className="mt-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-800">
                    Error: {step.error}
                  </div>
                )}

                {/* In Progress Indicator */}
                {step.status === 'in_progress' && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Processing...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="border-t p-4 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-2">
          {plan.status === 'executing' && (
            <>
              {isPaused ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResume}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Resume
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePause}
                  className="flex items-center gap-2"
                >
                  <Pause className="h-4 w-4" />
                  Pause
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="text-red-600 hover:text-red-700 dark:text-red-400"
              >
                Cancel
              </Button>
            </>
          )}
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {plan.status === 'planning' && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Planning...
            </span>
          )}
          {plan.status === 'executing' && !isPaused && (
            <span className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Executing
            </span>
          )}
          {isPaused && (
            <span className="text-sm text-yellow-600 dark:text-yellow-400">
              Paused
            </span>
          )}
          {plan.status === 'completed' && (
            <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Completed
            </span>
          )}
          {plan.status === 'failed' && (
            <span className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Failed
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default TaskExecutionPanel
