# TriChat - Multi-LLM Chat Application

An open-source, high-performance multi-LLM chat application built for **raw speed and minimal latency**. Features a unique Trinity mode that combines multiple AI perspectives for enhanced responses.

## 🚀 Features

### Core Chat Features
- **Streaming Multi-LLM Support** - Real-time streaming responses with support for multiple LLM providers
- **Trinity Mode** - Unique multi-agent system that combines:
  - 🔍 **Analytical Agent** - Provides logical, data-driven analysis
  - 🎨 **Creative Agent** - Offers imaginative and innovative perspectives  
  - 📊 **Factual Agent** - Delivers accurate, evidence-based information
  - ✨ **Orchestrated Synthesis** - Intelligently blends all three perspectives
- **Memory Cards & Graph** - Visual knowledge management with interactive memory cards
- **Thread Management** - Create, search, and manage conversation threads
- **Real-time Sync** - WebSocket-powered live updates across sessions
- **Dark Mode UI** - Beautiful glass-morphism design with smooth animations

### Technical Highlights
- **Ultra-fast Performance** - Optimized for minimal latency
- **Type-safe** - End-to-end TypeScript with tRPC
- **Real-time Streaming** - SSE and WebSocket support
- **PWA Ready** - Installable progressive web app
- **Mobile Responsive** - Optimized for all screen sizes

## 🛠️ Tech Stack

### Frontend
- **Svelte + Vite** - Lightning-fast reactive UI
- **TypeScript** - Full type safety
- **TailwindCSS** - Utility-first styling
- **Glass Morphism** - Modern UI with blur effects

### Backend  
- **Bun Runtime** - Ultra-fast JavaScript runtime
- **tRPC** - End-to-end typesafe APIs
- **Prisma** - Type-safe database ORM
- **PostgreSQL** - Primary data store with PgVector for embeddings
- **Neo4j** - Graph database for memory relationships

### Infrastructure
- **WebSockets & SSE** - Real-time bidirectional communication
- **OpenRouter** - Multi-LLM proxy support
- **Clerk** - Authentication and user management

## 🚦 Getting Started

### Prerequisites
- [Bun](https://bun.sh) (v1.0+)
- PostgreSQL (with PgVector extension)
- Neo4j (optional, for memory graph)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/trichat.git
cd trichat
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
cd apps/backend
bun run prisma migrate dev
```

5. Start the development servers:
```bash
# From the root directory
bun run dev
```

The app will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

## 🎯 Trinity Mode

Trinity Mode is TriChat's unique multi-agent system that provides comprehensive, multi-perspective responses:

### How it Works
1. **Parallel Processing** - All three agents process your query simultaneously
2. **Specialized Perspectives**:
   - Analytical: Breaks down complex problems, provides structured analysis
   - Creative: Explores innovative solutions, thinks outside the box
   - Factual: Ensures accuracy with evidence-based information
3. **Intelligent Synthesis** - An orchestrator blends the best insights from all agents
4. **Attribution** - See how much each agent contributed to the final response

### Execution Modes
- **Parallel** - All agents work simultaneously (fastest)
- **Sequential** - Agents build upon each other's responses
- **Hybrid** - Combines parallel and sequential for optimal results

## 📁 Project Structure

```
TriChat/
├── apps/
│   ├── frontend/          # Svelte frontend application
│   │   ├── src/
│   │   │   ├── lib/       # Components and utilities
│   │   │   └── App.svelte # Main app component
│   │   └── package.json
│   └── backend/           # Bun + tRPC backend
│       ├── src/
│       │   ├── routes/    # API routes
│       │   ├── lib/       # Core logic
│       │   └── trpc/      # tRPC setup
│       ├── prisma/        # Database schema
│       └── package.json
├── packages/
│   └── shared/           # Shared types and utilities
└── package.json          # Root package.json
```

## 🧪 Development

### Running Tests
```bash
# Run all tests
bun test

# Run frontend tests
cd apps/frontend && bun test

# Run backend tests  
cd apps/backend && bun test
```

### Building for Production
```bash
# Build all apps
bun run build

# Build frontend only
cd apps/frontend && bun run build

# Build backend only
cd apps/backend && bun run build
```

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built for the T3 Stack Cloneathon
- Inspired by the need for fast, multi-perspective AI chat
- Special thanks to all contributors

---

**Built with ❤️ using Bun, Svelte, and TypeScript**
