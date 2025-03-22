# Guide for Adding and Removing Models in ExaChat

This guide explains how to customize the models available in your ExaChat application.

## Understanding the Model Structure

Each model in the app is defined by these properties:

```json
{
  "id": "model-id",              // Unique ID used in API calls
  "name": "Display Name",        // Name shown in the UI dropdowns
  "provider": "Provider Name",   // Human-readable provider name
  "providerId": "provider",      // Provider identifier (google, groq, openrouter, exa)
  "enabled": true,               // Whether the model is available for selection
  "toolCallType": "native",      // "native" or "manual" for tool calling capabilities
  "searchMode": false            // Optional: true for search-focused models
}
```

## Adding a New Model

### Example: Adding Claude 3 Opus via OpenRouter

1. Open `models.json`
2. Add a new entry to the `models` array:

```json
{
  "id": "claude-3-opus",
  "name": "Claude 3 Opus",
  "provider": "OpenRouter",
  "providerId": "openrouter",
  "enabled": true,
  "toolCallType": "native"
}
```

3. Update the OpenRouter API route mapping in `app/api/openrouter/route.ts`:

```typescript
const MODEL_MAPPING: Record<string, string> = {
  'gemma3-27b': 'google/gemma-3-27b:free',
  'claude-3-opus': 'anthropic/claude-3-opus',
};
```

## Removing a Model

You have two options:

### Option 1: Disable the Model
This keeps the model in the file but hides it from the UI:

```json
{
  "id": "llama-3.2-1b-preview",
  "name": "LLaMA 3.2 1B Preview",
  "provider": "Groq",
  "providerId": "groq",
  "enabled": false,  // Changed from true to false
  "toolCallType": "manual"
}
```

### Option 2: Delete the Model Entry
Simply remove the entire model object from the `models` array in `models.json`.

## Adding a Custom Model Group

If you want to organize models into logical groups, create a naming convention:

```json
{
  "id": "custom-group-model1",
  "name": "Custom Group: Model 1",
  "provider": "Your Provider",
  "providerId": "custom",
  "enabled": true,
  "toolCallType": "manual"
}
```

## Testing After Changes

After modifying `models.json`:

1. Restart your development server
2. Check that the model selector shows your changes
3. Test the new model to ensure it works correctly 