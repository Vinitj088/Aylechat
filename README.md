# 💬 AyleChat App
### Powered by [Exa](https://exa.ai) - The Web Search API

An open-source chat app showcasing the power of Exa's Answer endpoint.

![capture](/public/homepage.png)

### ✨ Try it yourself:

- [Live Demo](https://exa-chat.vercel.app/) - See the chat app in action

<br>

## 🎯 What is Ayle Answer Chat App?

Ayle Chat is a open-source custom-built AI chat application leveraging the power of Groq and Exa Search for unparalleled speed and providing immediate access to cutting-edge Large Language Models (LLMs).



<br>

## 💻 Tech Stack
- **Backend**: [Exa API](https://exa.ai) - Answer endpoint
- **Frontend**: [Next.js](https://nextjs.org/docs) with App Router
- **Authentication**: [Supabase Auth](https://supabase.com/auth) for user management
- **Database**: Supabase PostgreSQL for user data, [Upstash Redis](https://upstash.com/) for chat threads
- **Styling**: [TailwindCSS](https://tailwindcss.com) with [shadcn/ui](https://ui.shadcn.com/)
- **Language**: TypeScript
- **Hosting**: [Vercel](https://vercel.com/)

<br>

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- Exa API key ([Get it here](https://dashboard.exa.ai/api-keys))
- Supabase account for authentication
- Upstash Redis for chat history

### Installation

1. Clone the repository
```bash
git clone https://github.com/Vinitj088/AyleChat.git
cd AyleChat
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env.local
```
Then add your API keys and service URLs to `.env.local`:
```
# API Keys
EXA_API_KEY=your-exa-api-key
GROQ_API_KEY=your-groq-api-key
GOOGLE_AI_API_KEY=your-google-ai-api-key  # Required for Gemini models
CEREBRAS_API_KEY=your-cerebras-api-key  # Required for Cerebras models

# Upstash Redis
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

4. Run the development server
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

<br>

## 🔐 Authentication System

This application uses Supabase Auth as the primary authentication system:

### Features

- Secure credential-based authentication
- JWT session management
- Persistent user sessions
- Database integration with Supabase PostgreSQL
- Custom signup and profile management
- Protected API routes and pages


<br>

## ⭐ About [Exa](https://exa.ai)

This project showcases [Exa's](https://exa.ai) Answer endpoint, which provides:

* Real-time streaming responses
* High-quality answers with citations
* Simple API integration (with OpenAI compatible API)

<br>

## Redis Integration

This application uses Upstash Redis to store chat threads for authenticated users. Each user has their own private chat history that persists between sessions.

### Setup Redis

1. Create an account at [Upstash](https://upstash.com/)
2. Create a new Redis database
3. Copy your REST URL and REST Token
4. Add them to your `.env` file:

```
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
```

### Features

- User-specific chat history
- Persistent chat threads
- Real-time updates
- Privacy protection (each user can only access their own threads)

<br>

## Features

- Multi-model support (Gemini, Groq, OpenRouter, Exa)
- Real-time streaming responses
- Conversation history
- Authentication with Supabase
- Mobile-responsive design
- Math formula support with KaTeX
- Code syntax highlighting
- Markdown rendering

## Environment Variables

The application requires these environment variables:

```
# API Keys
EXA_API_KEY=your-exa-api-key
GROQ_API_KEY=your-groq-api-key
GOOGLE_AI_API_KEY=your-google-ai-api-key  # Required for Gemini models
CEREBRAS_API_KEY=your-cerebras-api-key  # Required for Cerebras models

# Upstash Redis
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## API Integrations

### Google Gemini API
Provides access to Google's Gemini models. Get an API key from [Google AI Studio](https://aistudio.google.com/).

### Groq API
Fast inference for various open-source models. Get an API key from [Groq Cloud](https://console.groq.com/).

### Exa Search API
Provides search capabilities with AI-powered answers. Get an API key from [Exa](https://exa.ai/).

### OpenRouter API
Provides access to a variety of models including Gemma 3 27B. Get an API key from [OpenRouter](https://openrouter.ai/).

### Cerebras API
High-performance inference for LLaMA 3 models. Get an API key from [Cerebras Inference](https://inference.cerebras.ai/).

## Available Models

The application includes support for:

- Google Gemini models (2.5 Pro, 2.0 Flash etc.)
- Groq-hosted models (LLaMA 3, Mistral, etc.)
- OpenRouter models (including Gemma 3 27B, Mistral 3.1 24B)
- Cerebras models (LLaMA 3.1 8B, LLaMA 3.3 70B)
- Exa Search

## Deployment

This application can be deployed on Vercel:

1. Push your code to GitHub
2. Import the repository in Vercel
3. Configure the environment variables
4. Deploy!

---

Built with ❤️ using [Exa](https://exa.ai)
