# 🚀 Agentic Features - 30 Minute Quick Start

**Goal:** Transform AyleChat into an agentic AI in under 30 minutes

---

## ⚡ **Quick Implementation (Copy & Paste)**

### **Step 1: Add Multi-Step Task Execution** (10 minutes)

#### **A. Update `app/page.tsx`:**

Add imports at the top:
```typescript
import { planComplexTask, executeTaskStep, TaskPlan, TaskStep } from './api/services/taskPlanner';
import TaskExecutionPanel from './component/TaskExecutionPanel';
```

Add state variables (line ~96):
```typescript
const [taskPlan, setTaskPlan] = useState<TaskPlan | null>(null);
const [isExecutingPlan, setIsExecutingPlan] = useState(false);
```

Add task execution function (before `handleSubmit`):
```typescript
const executeTaskPlan = async (plan: TaskPlan) => {
  setIsExecutingPlan(true);
  setTaskPlan(plan);

  const results = new Map<string, string>();

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];

    // Update step to in_progress
    plan.steps[i].status = 'in_progress';
    plan.currentStepIndex = i;
    setTaskPlan({ ...plan });

    try {
      // Execute step
      const result = await executeTaskStep(step, plan, results);

      if (result.success) {
        plan.steps[i].status = 'completed';
        plan.steps[i].result = result.result;
        results.set(step.id, result.result);

        // Add result as assistant message
        const stepMessage: Message = {
          id: `step-${step.id}`,
          role: 'assistant',
          content: `**Step ${i + 1} Complete:** ${step.description}\n\n${result.result.substring(0, 500)}...`,
          createdAt: new Date(),
          completed: true,
        };

        setMessages(prev => [...prev, stepMessage]);
      } else {
        plan.steps[i].status = 'failed';
        plan.steps[i].error = result.error;
      }

      setTaskPlan({ ...plan });
    } catch (error) {
      plan.steps[i].status = 'failed';
      plan.steps[i].error = error instanceof Error ? error.message : 'Unknown error';
      setTaskPlan({ ...plan });
      break;
    }
  }

  // Mark plan as completed
  plan.status = plan.steps.every(s => s.status === 'completed') ? 'completed' : 'failed';
  setTaskPlan({ ...plan });
  setIsExecutingPlan(false);

  // Final summary message
  const summaryMessage: Message = {
    id: `plan-complete-${Date.now()}`,
    role: 'assistant',
    content: `✅ **Task Complete!** All ${plan.steps.length} steps executed successfully.`,
    createdAt: new Date(),
    completed: true,
  };

  setMessages(prev => [...prev, summaryMessage]);
};
```

Modify `handleSubmit` (around line ~400, before fetching response):
```typescript
// Check if this is a complex task that needs planning
const plan = await planComplexTask(trimmedInput, messages);

if (plan) {
  console.log('Complex task detected, creating plan:', plan);

  // Execute the plan
  await executeTaskPlan(plan);

  setIsLoading(false);
  return; // Don't continue to regular response
}

// ... rest of existing handleSubmit code
```

Add UI in render (before ChatMessages component):
```typescript
{/* Task Execution Panel */}
{taskPlan && (
  <TaskExecutionPanel
    plan={taskPlan}
    onPause={() => console.log('Pause not implemented yet')}
    onResume={() => console.log('Resume not implemented yet')}
    onCancel={() => {
      setTaskPlan(null);
      setIsExecutingPlan(false);
    }}
  />
)}
```

---

### **Step 2: Add Proactive Suggestions** (10 minutes)

#### **A. Update `app/page.tsx`:**

Add imports:
```typescript
import { generateSuggestions, Suggestion } from './api/services/proactiveSuggestions';
import SuggestionChips from './component/SuggestionChips';
```

Add state (line ~96):
```typescript
const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
```

Add effect to generate suggestions after AI response:
```typescript
// Generate suggestions after AI response completes
useEffect(() => {
  const lastMessage = messages[messages.length - 1];

  if (
    lastMessage &&
    lastMessage.role === 'assistant' &&
    lastMessage.completed &&
    !isLoading &&
    messages.length > 1
  ) {
    // Generate suggestions
    generateSuggestions(messages, lastMessage).then(newSuggestions => {
      setSuggestions(newSuggestions);
    });
  }
}, [messages, isLoading]);
```

Add suggestion handler:
```typescript
const handleSuggestionSelect = (suggestion: Suggestion) => {
  if (suggestion.action) {
    setInput(suggestion.action);
    // Optionally auto-submit
    setTimeout(() => handleSubmit(), 100);
  }
};
```

---

#### **B. Update `app/component/ChatMessages.tsx`:**

Add imports:
```typescript
import SuggestionChips from './SuggestionChips';
import type { Suggestion } from '../api/services/proactiveSuggestions';
```

Add prop:
```typescript
interface ChatMessagesProps {
  // ... existing props
  suggestions?: Suggestion[];
  onSuggestionSelect?: (suggestion: Suggestion) => void;
}
```

Add to component params:
```typescript
const ChatMessages = memo(function ChatMessages({
  // ... existing params
  suggestions,
  onSuggestionSelect,
}: ChatMessagesProps) {
```

Add in render (after messages, before loading indicator):
```typescript
{/* Suggestions after last completed message */}
{!isLoading && suggestions && suggestions.length > 0 && (
  <SuggestionChips
    suggestions={suggestions}
    onSelect={onSuggestionSelect || (() => {})}
    className="mb-4"
  />
)}
```

Update usage in `page.tsx`:
```typescript
<ChatMessages
  // ... existing props
  suggestions={suggestions}
  onSuggestionSelect={handleSuggestionSelect}
/>
```

---

### **Step 3: Add Basic Memory** (10 minutes)

#### **A. Add simple memory extraction:**

Add imports in `page.tsx`:
```typescript
import { extractMemories } from './api/services/agentMemory';
```

Add effect to extract memories periodically:
```typescript
// Extract memories every 5 messages
useEffect(() => {
  if (user && messages.length > 0 && messages.length % 5 === 0) {
    extractMemories(messages, user.id).catch(err =>
      console.error('Memory extraction error:', err)
    );
  }
}, [messages.length, user]);
```

That's it! Memory will be stored automatically.

---

## 🎉 **You're Done!**

### **Test Your Agentic Features:**

#### **1. Test Multi-Step Execution:**
```
Ask: "Research the top 3 programming languages,
      compare their performance, and create a summary"

Expected: Task panel appears with 4-5 steps, executes autonomously
```

#### **2. Test Proactive Suggestions:**
```
Ask: "What are React hooks?"

Expected: After response, see suggestion chips like:
  • Show me examples
  • Explain useEffect
  • Compare with class components
```

#### **3. Test Memory (requires 2 conversations):**
```
Conversation 1:
User: "I'm working on a TypeScript project"

Conversation 2 (later):
User: "How do I add types?"

Expected: Agent remembers it's a TypeScript project
```

---

## 🎨 **Optional: Style Enhancements**

### **Make Task Panel More Prominent:**

In `app/component/TaskExecutionPanel.tsx`, change line 172:
```typescript
<div className="border rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 shadow-xl max-w-2xl mx-auto my-4">
```

### **Make Suggestions More Eye-Catching:**

In `app/component/SuggestionChips.tsx`, change line 54:
```typescript
<div className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
  <Sparkles className="h-4 w-4 animate-pulse" />
  <span>✨ Smart Suggestions</span>
</div>
```

---

## 📊 **Verify It's Working**

### **Check Console Logs:**
```
✅ "Complex task detected, creating plan:"
✅ "Executing step: ..."
✅ "Tool analysis cache HIT for: ..."
✅ "Stored 3 memories for user ..."
✅ "Memory cleanup complete. X memories retained."
```

### **Check UI:**
```
✅ Task execution panel appears for complex queries
✅ Progress bar shows step completion
✅ Suggestion chips appear after responses
✅ Suggestions are clickable and execute
```

---

## 🐛 **Troubleshooting**

### **Task Panel Not Appearing:**
- Check if query is complex enough (needs "and", "then", "compare", etc.)
- Look for console log "Complex task detected"
- Ensure TaskExecutionPanel is imported correctly

### **Suggestions Not Showing:**
- Wait for assistant response to complete
- Check messages.length > 1
- Look for console errors in generateSuggestions

### **Memory Not Working:**
- Ensure user is authenticated (user object exists)
- Check console for "Stored X memories"
- Memory only extracts every 5 messages

---

## 🚀 **Next Level (Optional)**

### **Add Agent Status Indicator:**

Create `app/component/AgentStatus.tsx`:
```typescript
"use client"

export default function AgentStatus({
  status
}: {
  status: 'idle' | 'thinking' | 'planning' | 'executing' | 'complete'
}) {
  const statusConfig = {
    idle: { emoji: '😴', text: 'Ready', color: 'text-gray-500' },
    thinking: { emoji: '🤔', text: 'Thinking...', color: 'text-blue-500' },
    planning: { emoji: '📋', text: 'Planning...', color: 'text-purple-500' },
    executing: { emoji: '⚡', text: 'Executing...', color: 'text-green-500' },
    complete: { emoji: '✅', text: 'Complete', color: 'text-green-600' },
  };

  const config = statusConfig[status];

  return (
    <div className={`flex items-center gap-2 text-sm ${config.color}`}>
      <span>{config.emoji}</span>
      <span className="font-medium">{config.text}</span>
    </div>
  );
}
```

Add to header in `page.tsx`:
```typescript
<AgentStatus status={
  isExecutingPlan ? 'executing' :
  isLoading ? 'thinking' :
  taskPlan ? 'planning' :
  'idle'
} />
```

---

## 📝 **Cheat Sheet**

### **Service Imports:**
```typescript
// Task execution
import { planComplexTask, executeTaskStep } from './api/services/taskPlanner';

// Suggestions
import { generateSuggestions } from './api/services/proactiveSuggestions';

// Memory
import { extractMemories, enrichQueryWithMemory } from './api/services/agentMemory';
```

### **Component Imports:**
```typescript
import TaskExecutionPanel from './component/TaskExecutionPanel';
import SuggestionChips from './component/SuggestionChips';
```

---

## 🎯 **Success Criteria**

You've successfully added agentic features when:

✅ Complex queries trigger multi-step execution
✅ Task panel shows real-time progress
✅ Suggestion chips appear after responses
✅ Clicking suggestions executes them
✅ Agent remembers context across conversations
✅ Console shows memory extraction logs

---

**🎉 Congratulations! Your AyleChat is now agentic!**

For advanced features, see `AGENTIC_FEATURES_ROADMAP.md`
