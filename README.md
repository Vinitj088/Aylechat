# 💬 AyleChat App

An open-source chat app showcasing powerful AI capabilities with multiple model integrations.

![capture](/public/homepage.png)

### ✨ Try it yourself:

- [Live Demo](https://ayle.chat/) - See the chat app in action

<br>

## 🎯 What is Ayle Chat?

AyleChat is an open-source custom-built AI chat application that integrates multiple AI providers including Groq, Google's Gemini, OpenRouter, Cerebras, and Exa Search for unparalleled speed and providing immediate access to cutting-edge Large Language Models (LLMs).

<br>

## 💻 Tech Stack
- **Frontend**: [Next.js 15](https://nextjs.org/docs) with App Router and Turbopack
- **Authentication**: [Supabase Auth](https://supabase.com/auth) for user management
- **Database**: Supabase PostgreSQL for user data, [Upstash Redis](https://upstash.com/) for chat threads
- **Styling**: [TailwindCSS](https://tailwindcss.com) with [shadcn/ui](https://ui.shadcn.com/)
- **Language**: TypeScript
- **Hosting**: [Vercel](https://vercel.com/)

<br>

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- API keys for your chosen model providers
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

## ⭐ Supported AI Models

This application integrates with several AI model providers:

### Google Gemini
- Gemini 2.5 Pro
- Gemini 2.5 Flash
- Gemini 2.0 Pro
- Gemini 2.0 Flash
- Experimental image generation models

### Groq
- LLaMA 3.1, 3.2, and 3.3 series (various sizes)
- Gemma 2 models
- QWEN 2.5 models
- DeepSeek models
- Meta LLaMA 4 Scout

### OpenRouter
- Mistral Small 3.1 24B
- DeepSeek models
- Gemma 3 27B
- Meta LLaMA 4 Maverick

### Cerebras
- LLaMA 3.1 and 3.3 models

### Exa Search
- Web search integration with AI answer processing

<br>

## 🛠️ Features

- Multi-provider model support (Google, Groq, OpenRouter, Cerebras, Exa)
- Real-time streaming responses
- User-specific conversation history
- Secure authentication with Supabase
- Mobile-responsive design
- Math formula support with KaTeX
- Code syntax highlighting
- Markdown rendering
- Media card support with /movies and /tv commands
- Tool calling capabilities (varies by model)
- Web search integration
- Prompt enhancing using QueryEnhancer
- Live URL answers Support (pass Webpage URLs and chat with the LLM)
- Attachments Support in Chat Input

## Deployment

This application can be deployed on Vercel:

1. Push your code to GitHub
2. Import the repository in Vercel
3. Configure the environment variables
4. Deploy!

---

Built with ❤️ using [Next.js](https://nextjs.org), [Supabase](https://supabase.com), and various AI model providers
