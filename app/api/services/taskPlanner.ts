import { Message } from '../../types';

// --- Autonomous Task Planning Service ---

export type TaskStep = {
  id: string;
  description: string;
  action: 'search' | 'scrape' | 'analyze' | 'generate' | 'tool_call';
  toolCommand?: string;
  dependencies: string[]; // IDs of steps that must complete first
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
};

export type TaskPlan = {
  id: string;
  originalQuery: string;
  steps: TaskStep[];
  currentStepIndex: number;
  status: 'planning' | 'executing' | 'completed' | 'failed';
  createdAt: Date;
};

/**
 * Analyzes a complex query and breaks it down into executable steps
 * @param query - User's complex request
 * @param messages - Conversation context
 * @returns Task plan with steps to execute
 */
export async function planComplexTask(
  query: string,
  messages: Message[]
): Promise<TaskPlan | null> {
  // Detect if query is complex enough to need planning
  if (!isComplexTask(query)) {
    return null; // Single-step task, no planning needed
  }

  const planningPrompt = `You are an AI task planner. Break down the following complex request into clear, executable steps.

User Request: "${query}"

Conversation Context:
${messages.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}

Available Actions:
- search: Use Exa search for finding information
- scrape: Scrape URLs for detailed content
- analyze: Analyze and process information
- generate: Generate content (text, code, summaries)
- tool_call: Use specific tools (/weather, /movies, /tv)

Respond with a JSON array of steps in this format:
{
  "steps": [
    {
      "description": "Search for top AI frameworks",
      "action": "search",
      "toolCommand": null,
      "dependencies": []
    },
    {
      "description": "Research PyTorch documentation",
      "action": "scrape",
      "toolCommand": null,
      "dependencies": ["step-1"]
    },
    {
      "description": "Compare frameworks based on research",
      "action": "analyze",
      "toolCommand": null,
      "dependencies": ["step-1", "step-2"]
    }
  ]
}

Rules:
- Keep steps atomic and focused
- Identify dependencies clearly
- Use appropriate actions for each step
- Maximum 10 steps per plan
- Be specific in descriptions`;

  try {
    const response = await fetch('/api/groq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: planningPrompt,
        model: 'llama-3.3-70b-versatile',
        systemPrompt: 'You are an expert task planner that breaks down complex requests into executable steps.',
        stream: false,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      console.error('Task planning failed:', response.status);
      return null;
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;

    if (!content) {
      return null;
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const planData = JSON.parse(jsonMatch[0]);

    // Create task plan
    const taskPlan: TaskPlan = {
      id: crypto.randomUUID(),
      originalQuery: query,
      steps: planData.steps.map((step: any, index: number) => ({
        id: `step-${index + 1}`,
        description: step.description,
        action: step.action,
        toolCommand: step.toolCommand || undefined,
        dependencies: step.dependencies || [],
        status: 'pending' as const,
      })),
      currentStepIndex: 0,
      status: 'planning',
      createdAt: new Date(),
    };

    console.log('Task plan created:', taskPlan);
    return taskPlan;
  } catch (error) {
    console.error('Error creating task plan:', error);
    return null;
  }
}

/**
 * Determines if a query is complex enough to need multi-step planning
 */
function isComplexTask(query: string): boolean {
  const complexityIndicators = [
    'research and',
    'compare',
    'analyze and',
    'find and summarize',
    'create a report',
    'investigate',
    'step by step',
    'first.*then',
    'after that',
    'multiple',
  ];

  const lowerQuery = query.toLowerCase();
  return complexityIndicators.some(indicator =>
    new RegExp(indicator).test(lowerQuery)
  );
}

/**
 * Executes a single step from the task plan
 */
export async function executeTaskStep(
  step: TaskStep,
  plan: TaskPlan,
  previousResults: Map<string, string>
): Promise<{ success: boolean; result: string; error?: string }> {
  console.log(`Executing step: ${step.description}`);

  try {
    switch (step.action) {
      case 'search':
        return await executeSearch(step, previousResults);

      case 'scrape':
        return await executeScrape(step, previousResults);

      case 'analyze':
        return await executeAnalysis(step, previousResults, plan);

      case 'generate':
        return await executeGeneration(step, previousResults, plan);

      case 'tool_call':
        return await executeToolCall(step, previousResults);

      default:
        return {
          success: false,
          result: '',
          error: `Unknown action: ${step.action}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      result: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Helper execution functions
async function executeSearch(
  step: TaskStep,
  previousResults: Map<string, string>
): Promise<{ success: boolean; result: string }> {
  // Extract search query from step description or use previous results
  const searchQuery = step.description.replace(/^search for /i, '');

  const response = await fetch('/api/exaanswer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: searchQuery,
      messages: [],
    }),
  });

  if (!response.ok) {
    throw new Error('Search failed');
  }

  // Parse streaming response
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.choices?.[0]?.delta?.content) {
          result += data.choices[0].delta.content;
        }
      } catch {
        continue;
      }
    }
  }

  return { success: true, result };
}

async function executeScrape(
  step: TaskStep,
  previousResults: Map<string, string>
): Promise<{ success: boolean; result: string }> {
  // Extract URL from step description or previous results
  const urlMatch = step.description.match(/https?:\/\/[^\s]+/);
  const url = urlMatch ? urlMatch[0] : '';

  if (!url) {
    // Try to find URL in previous results
    const previousResult = Array.from(previousResults.values()).join('\n');
    const foundUrl = previousResult.match(/https?:\/\/[^\s]+/);
    if (!foundUrl) {
      throw new Error('No URL found to scrape');
    }
  }

  // Import scraper dynamically to avoid circular deps
  const { scrapeUrlContent } = await import('./urlScraper');
  const controller = new AbortController();

  const scrapedContent = await scrapeUrlContent(url, controller);

  if (!scrapedContent) {
    throw new Error('Scraping failed');
  }

  return { success: true, result: scrapedContent };
}

async function executeAnalysis(
  step: TaskStep,
  previousResults: Map<string, string>,
  plan: TaskPlan
): Promise<{ success: boolean; result: string }> {
  // Gather context from dependencies
  const dependencyResults = step.dependencies
    .map(depId => previousResults.get(depId))
    .filter(Boolean)
    .join('\n\n---\n\n');

  const analysisPrompt = `${step.description}

Context from previous steps:
${dependencyResults}

Provide a thorough analysis based on the context above.`;

  const response = await fetch('/api/groq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: analysisPrompt,
      model: 'llama-3.3-70b-versatile',
      systemPrompt: 'You are an expert analyst. Provide clear, detailed analysis based on the given information.',
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error('Analysis failed');
  }

  const result = await response.json();
  const content = result.choices[0]?.message?.content || '';

  return { success: true, result: content };
}

async function executeGeneration(
  step: TaskStep,
  previousResults: Map<string, string>,
  plan: TaskPlan
): Promise<{ success: boolean; result: string }> {
  // Similar to analysis but focused on generation
  const allResults = Array.from(previousResults.values()).join('\n\n---\n\n');

  const generationPrompt = `${step.description}

Based on all previous work:
${allResults}

Original request: ${plan.originalQuery}

Generate the requested output.`;

  const response = await fetch('/api/groq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: generationPrompt,
      model: 'llama-3.3-70b-versatile',
      systemPrompt: 'You are an expert content generator. Create high-quality, well-formatted output.',
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error('Generation failed');
  }

  const result = await response.json();
  const content = result.choices[0]?.message?.content || '';

  return { success: true, result: content };
}

async function executeToolCall(
  step: TaskStep,
  previousResults: Map<string, string>
): Promise<{ success: boolean; result: string }> {
  if (!step.toolCommand) {
    throw new Error('Tool command not specified');
  }

  const [command, ...args] = step.toolCommand.split(' ');
  const query = args.join(' ');

  const response = await fetch('/api/command-handler', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, query }),
  });

  if (!response.ok) {
    throw new Error('Tool call failed');
  }

  const result = await response.json();
  return { success: true, result: result.answer || JSON.stringify(result.data) };
}
