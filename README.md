# 💬 Exa Answer Chat App
### Powered by [Exa](https://exa.ai) - The Web Search API

An open-source chat app showcasing the power of Exa's Answer endpoint.

![Screenshot](https://demo.exa.ai/answer/opengraph-image.jpg)

### ✨ Try it yourself:
- [Try the Answer Endpoint](https://dashboard.exa.ai/playground/answer?q=What%20makes%20some%20LLMs%20so%20much%20better%20than%20others%3F&filters=%7B%22model%22%3A%22exa-pro%22%7D) - Experience the Answer endpoint directly on Exa dashboard

- [Live Demo](https://exa-chat.vercel.app/) - See the chat app in action

<br>

## 🎯 What is Exa Answer Chat App?

Exa Answer Chat App is a free and open-source application that shows how to use Exa's Answer endpoint. It provides a modern chat interface with real-time streaming responses and citation support.

<br>

## 💻 Tech Stack
- **Backend**: [Exa API](https://exa.ai) - Answer endpoint
- **Frontend**: [Next.js](https://nextjs.org/docs) with App Router
- **Authentication**: [NextAuth.js](https://next-auth.js.org/) with custom database integration
- **Database**: PostgreSQL for user data, [Upstash Redis](https://upstash.com/) for chat threads
- **Styling**: [TailwindCSS](https://tailwindcss.com)
- **Language**: TypeScript
- **Hosting**: [Vercel](https://vercel.com/)

<br>

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- Exa API key ([Get it here](https://dashboard.exa.ai/api-keys))
- PostgreSQL database for auth (or use Vercel Postgres)

### Installation

1. Clone the repository
```bash
git clone https://github.com/Vinitj088/ExaChat.git
cd ExaChat
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env.local
```
Then add your API keys and database URLs to `.env.local`:
```
# Exa API
EXA_API_KEY=your-api-key-here

# Auth (required)
DATABASE_URL=your-postgres-url
NEXTAUTH_SECRET=your-nextauth-secret-key
NEXTAUTH_URL=http://localhost:3000

# Redis (required for chat history)
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
```

4. Run the development server
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

<br>

## 🔐 Authentication System

This application uses NextAuth.js as the primary authentication system, with custom extensions for enhanced functionality:

### Features

- Secure credential-based authentication
- JWT session management
- Persistent user sessions
- Database integration with PostgreSQL
- Custom signup and profile management
- Protected API routes and pages

### Usage

The app provides a centralized authentication hook that should be used in all components:

```tsx
import { useAuth } from '@/lib/hooks/useAuth';

function MyComponent() {
  const { user, isAuthenticated, signIn, signUp, signOut } = useAuth();
  
  // Use these methods and state for auth operations
}
```

For server-side authentication checking, use NextAuth's built-in methods.

<br>

## ⭐ About [Exa](https://exa.ai)

This project showcases [Exa's](https://exa.ai) Answer endpoint, which provides:

* Real-time streaming responses
* High-quality answers with citations
* Simple API integration (with OpenAI compatible API)

[Try Exa API](https://dashboard.exa.ai) today and build your own AI-powered applications!

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

## Environment Variables

The application requires these environment variables:

```
# Supabase Configuration (for authentication)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Redis Configuration (for conversation storage)
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token

# AI Model API Keys
EXA_API_KEY=your_exa_api_key
GOOGLE_AI_API_KEY=your_google_ai_api_key
GROQ_API_KEY=your_groq_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
```

## Getting Started

1. Clone the repository
2. Install dependencies with `npm install`
3. Create a `.env.local` file with the environment variables
4. Run the development server with `npm run dev`

## API Integrations

### Google Gemini API
Provides access to Google's Gemini models. Get an API key from [Google AI Studio](https://makersuite.google.com/).

### Groq API
Fast inference for various open-source models. Get an API key from [Groq Cloud](https://console.groq.com/).

### Exa Search API
Provides search capabilities with AI-powered answers. Get an API key from [Exa](https://exa.ai/).

### OpenRouter API
Provides access to a variety of models including Gemma 3 27B. Get an API key from [OpenRouter](https://openrouter.ai/).

## Available Models

The application includes support for:

- Google Gemini models (1.5 Pro, 1.5 Flash)
- Groq-hosted models (LLaMA 3, Mistral, etc.)
- OpenRouter models (including Gemma 3 27B)
- Exa Search

## Deployment

This application can be deployed on Vercel:

1. Push your code to GitHub
2. Import the repository in Vercel
3. Configure the environment variables
4. Deploy!

---

Built with ❤️ using [Exa](https://exa.ai)
