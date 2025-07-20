# 💬 AyleChat App
An open-source chat app showcasing powerful AI capabilities with multiple model integrations.
![capture](/public/homepage.png)
### ✨ Try it yourself:
- [Live Demo](https://ayle.chat/) - See the chat app in action

> ## 🎯 What is Ayle Chat?
AyleChat is an open-source custom-built AI chat application that integrates multiple AI providers including Groq, Google's Gemini, OpenRouter, Cerebras, and Exa Search for unparalleled speed and providing immediate access to cutting-edge Large Language Models (LLMs).

> ## 💻 Tech Stack
- **Frontend**: [Next.js 15](https://nextjs.org/docs) with App Router and Turbopack
- **Authentication**: [InstantDB](https://instantdb.com) for user authentication and management
- **Database**: [InstantDB](https://instantdb.com) for primary user/chat threads storage and Supabase bucket for image storage
- **Styling**: [TailwindCSS](https://tailwindcss.com) with [shadcn/ui](https://ui.shadcn.com/)
- **Language**: TypeScript
- **Hosting**: [Vercel](https://vercel.com/)

> ## 🚀 Getting Started
### Prerequisites
- Node.js 18+ installed
- API keys for your chosen model providers
- InstantDB account for authentication and database
- Supabase account for image generation features
- Backend services (InstantDB and Supabase) configured as detailed in the 'Backend Setup' section.

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
Then add your API keys and service URLs to `.env.local`. The necessary InstantDB and Supabase variables are detailed in the 'Backend Setup' section. You will also need to add API keys for any AI model providers you intend to use.
4. Run the development server
```bash
npm run dev
```
5. Open [http://localhost:3000](http://localhost:3000) in your browser

> ## Backend Setup

### InstantDB Setup
InstantDB serves as the primary database for user authentication and chat/thread storage:

1. **Create an InstantDB account** at [https://instantdb.com](https://instantdb.com)
2. **Create a new app** in your InstantDB dashboard
3. **Configure your environment variables**:
   * Find your **App ID** and **Admin Token** in your InstantDB dashboard
   * Add these to your `.env.local` file:
   ```env
   NEXT_PUBLIC_INSTANT_APP_ID=YOUR_INSTANT_APP_ID
   INSTANT_ADMIN_TOKEN=YOUR_INSTANT_ADMIN_TOKEN
   ```

### Supabase Setup
Supabase provides additional authentication features and user data storage:

1. **Create a Supabase account** at [https://supabase.com](https://supabase.com)
2. **Create a new project**
3. **Get your credentials**:
   * Go to Settings > API in your Supabase dashboard
   * Find your **Project URL** and **anon/public key**
   * Add these to your `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   ```

> ## Database Schema & Permissions

This application uses **InstantDB** as the primary database for authentication and chat/thread storage. InstantDB provides real-time synchronization and built-in authentication capabilities that streamline the development process.

### InstantDB Usage
- **Authentication**: Handles user registration, login, and session management
- **Chat Storage**: Stores all chat messages, threads, and conversation history
- **Real-time Updates**: Provides live synchronization across all connected clients

### Schema & Permissions Reference
The database schema and permissions configuration can be found in the following files within this repository:
- **Schema Definition**: `instant.schema.ts` - Contains the database table definitions and relationships
- **Permissions Configuration**: `instant.perms.ts` - Defines user access controls and data permissions

These files serve as a reference for setting up your InstantDB instance and understanding the data structure used by the application.

> ## 🔐 Authentication System
This application uses InstantDB as the primary authentication system:

### Features
- Secure credential-based authentication via InstantDB
- JWT session management
- Persistent user sessions
- Database integration with InstantDB for primary storage
- Custom signup and profile management
- Protected API routes and pages

> ## ⭐ Supported AI Models
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

> ## 🛠️ Features
- Multi-provider model support (Google, Groq, OpenRouter, Cerebras, Exa)
- Real-time streaming responses
- User-specific conversation history
- Secure authentication with InstantDB and Supabase
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
- Quote assistant responses and ask follow up questions

## Deployment
This application can be deployed on Vercel:
1. Push your code to GitHub
2. Import the repository in Vercel
3. Configure the environment variables
4. Deploy!


# For `upstash-redis` branch if you want to use redis for chat thread storage and supabase for auth

### Upstash Redis Setup [deprecated] [switch to upstash-redis branch to use this]
Upstash Redis is used for chat thread storage and caching:

1. **Create an Upstash account** at [https://upstash.com](https://upstash.com)
2. **Create a Redis database**:
   * Choose a region close to your deployment
   * Select the free tier for development
3. **Get your credentials**:
   * In your database dashboard, go to the **Details** tab
   * Find your **REST URL** (sometimes labeled as Endpoint) and **Token** (sometimes labeled as Password or Read/Write Token).
   * Add these to your `.env.local` file:
   ```env
   UPSTASH_REDIS_REST_URL=YOUR_UPSTASH_REDIS_REST_URL
   UPSTASH_REDIS_REST_TOKEN=YOUR_UPSTASH_REDIS_REST_TOKEN
   ```
 
### Supabase Setup
Supabase provides additional authentication features and user data storage:

1. **Create a Supabase account** at [https://supabase.com](https://supabase.com)
2. **Create a new project**
3. **Setup auth providers in authentication menu and add required details**
3. **Get your credentials**:
   * Go to Settings > API in your Supabase dashboard
   * Find your **Project URL** and **anon/public key**
   * Add these to your `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_PROJECT_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
   `
---
Refer to `supabase-storage.sql` and `supabase-schema.sql` for further details about configuring policies on bucket and tables respectively.

Built with ❤️ using [Next.js](https://nextjs.org), [InstantDB](https://instantdb.com), [Supabase](https://supabase.com), and various AI model providers
