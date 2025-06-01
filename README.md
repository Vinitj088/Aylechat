# 💬 AyleChat App

An open-source chat app showcasing powerful AI capabilities with multiple model integrations, now fully powered by the Vercel AI SDK for universal, agentic, and MCP workflows.

![capture](/public/homepage.png)

### ✨ Try it yourself:

- [Live Demo](https://ayle.chat/) - See the chat app in action

<br>

## 🎯 What is Ayle Chat?

AyleChat is an open-source custom-built AI chat application that integrates multiple AI providers including Groq, Google's Gemini, OpenRouter, Cerebras, and Exa Search for unparalleled speed and providing immediate access to cutting-edge Large Language Models (LLMs).

> **Now refactored to use the [Vercel AI SDK](https://sdk.vercel.ai/)** for all LLM, agentic, and tool-calling workflows. All provider logic is unified under a single API handler for maximum flexibility and future-proofing.

<br>

## 💻 Tech Stack
- **Frontend**: [Next.js 15](https://nextjs.org/docs) with App Router and Turbopack
- **AI Backend**: [Vercel AI SDK](https://sdk.vercel.ai/) (universal handler, agentic/MCP support)
- **Authentication**: [Supabase Auth](https://supabase.com/auth) for user management
- **Database**: Supabase PostgreSQL for user data, [Upstash Redis](https://upstash.com/) for chat threads
- **Styling**: [TailwindCSS](https://tailwindcss.com) with [shadcn/ui](https://ui.shadcn.com/)
- **Language**: TypeScript
- **Hosting**: [Vercel](https://vercel.com/)

<br>

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- API keys for your chosen model providers (see `.env.example`)
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

## ⭐ Supported AI Models (via Vercel AI SDK)

This application integrates with several AI model providers through the Vercel AI SDK universal handler:

- **Google Gemini**: Gemini 2.5 Pro, Flash, 2.0 Pro/Flash, image generation
- **Groq**: LLaMA 3.x, Gemma, QWEN, DeepSeek, Meta LLaMA 4
- **OpenRouter**: Mistral, DeepSeek, Gemma, Meta LLaMA 4
- **Cerebras**: LLaMA 3.x
- **Exa Search**: Web search integration

> **All LLM/chat requests are routed through `/api/ai` using the Vercel AI SDK.**

<br>

## 🛠️ Features

- **Universal AI SDK API handler**: All LLM, agentic, and tool-calling requests go through a single endpoint
- **Agentic/MCP support**: Easily add tool-calling and agent workflows (see code for examples)
- **Multi-provider model support** (Google, Groq, OpenRouter, Cerebras, Exa)
- **Real-time streaming responses**
- **User-specific conversation history**
- **Secure authentication with Supabase**
- **Mobile-responsive design**
- **Math formula support with KaTeX**
- **Code syntax highlighting**
- **Markdown rendering**
- **Media card support with /movies and /tv commands**
- **Web search integration**
- **Prompt enhancing using QueryEnhancer**
- **Live URL answers Support (pass Webpage URLs and chat with the LLM)**
- **Attachments Support in Chat Input**

## 🏗️ Migration Note

- All custom provider logic has been removed. The backend is now powered by the Vercel AI SDK universal handler (`/api/ai`).
- All message and thread types are AI SDK compatible (including agentic/tool-calling fields).
- See `REFACTOR_PLAN.md` for a detailed migration and compatibility checklist.

## Deployment

This application can be deployed on Vercel:

1. Push your code to GitHub
2. Import the repository in Vercel
3. Configure the environment variables
4. Deploy!

---

Built with ❤️ using [Next.js](https://nextjs.org), [Supabase](https://supabase.com), and [Vercel AI SDK](https://sdk.vercel.ai/)
