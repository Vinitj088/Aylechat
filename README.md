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
- Backend services (Supabase and Upstash Redis) configured as detailed in the 'Backend Setup' section.

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
Then add your API keys and service URLs to `.env.local`. The necessary Supabase and Upstash variables are detailed in the 'Backend Setup' section. You will also need to add API keys for any AI model providers you intend to use.

4. Run the development server
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

<br>

## Backend Setup

### Supabase Setup
To set up Supabase for this project, follow these steps:

1.  **Create a Supabase Project:**
    *   Go to [supabase.com](https://supabase.com), create an account or log in.
    *   Set up a new project.
    *   Choose a strong password for your database and save it securely.

2.  **Run SQL Schema:**
    *   Navigate to the **SQL Editor** in your Supabase project dashboard (usually found in the left sidebar under "Database").
    *   Copy the entire content of `supabase-schema.sql` (located at the root of this repository) from this repository.
    *   Paste the copied SQL into the Supabase SQL Editor and click **Run**. This will set up the necessary tables (`profiles`, `threads`, `thread_messages`) and Row Level Security (RLS) policies.

3.  **Configure Supabase Storage:**
    *   Navigate to the **Storage** section in your Supabase project dashboard.
    *   Click on **Create a new bucket**.
    *   Name the bucket `ai-generated-images`.
    *   Ensure this bucket is set to **Public**. This can typically be done via a toggle or policy setting during bucket creation, or by editing the bucket's settings/policies after creation to allow public read access (the `supabase-storage.sql` script also includes a command to attempt to set the bucket to public, but it's good to verify in the UI).
    *   Go back to the **SQL Editor**.
    *   Copy the entire content of `supabase-storage.sql` (located at the root of this repository) from this repository.
    *   Paste the copied SQL into the Supabase SQL Editor and click **Run**. This will configure the necessary policies for the storage bucket, allowing public read access and restricted write access.

4.  **Environment Variables:**
    *   In your Supabase project settings, navigate to the **API** section (usually under "Project Settings").
    *   Find your **Project URL** and **anon key**.
    *   Add these to your `.env.local` file in the root of this project:
        ```env
        NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
        NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
        ```

### Upstash Redis Setup
Upstash Redis is used for storing chat history to ensure persistence and performance, especially for streaming responses and managing conversation threads.

1.  **Create an Upstash Account and Database:**
    *   If you don't have an account, go to [upstash.com](https://upstash.com) and sign up.
    *   Create a new Redis database. Choose a region closest to your users or your Vercel deployment region for optimal performance.

2.  **Environment Variables:**
    *   From the Upstash console, navigate to your Redis database details page.
    *   Find your **REST URL** (sometimes labeled as Endpoint) and **Token** (sometimes labeled as Password or Read/Write Token).
    *   Add these to your `.env.local` file:
        ```env
        UPSTASH_REDIS_REST_URL=YOUR_UPSTASH_REDIS_REST_URL
        UPSTASH_REDIS_REST_TOKEN=YOUR_UPSTASH_REDIS_REST_TOKEN
        ```

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
