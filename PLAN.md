# MANOA Implementation Plan

## Current State
- Project skeleton at `matrix-ai/` with empty directories
- Only 2 real files: `.env` (config template) and `requirements.txt` (23 deps)
- 27 concept HTML files ready to be indexed as knowledge base
- Full tech stack defined: FastAPI + Next.js + PostgreSQL + ChromaDB + OpenAI

## Implementation Plan (5 Phases)

---

### Phase 1: Backend Foundation

**Files to create:**
```
backend/
  main.py                    # FastAPI app entry point
  database/
    connection.py            # SQLAlchemy engine + session
    models.py                # ORM models (User, Chat, Document, Ticket, Feedback, Log)
  auth/
    router.py                # Login/register/refresh endpoints
    service.py               # JWT creation, password hashing
    dependencies.py          # get_current_user, require_role() dependency
    schemas.py               # Pydantic models for auth
  models/
    schemas.py               # Pydantic schemas for all entities
```

**Database models:**
- **User**: id, name, email, hashed_password, role (admin/engineer/intern/supervisor), is_active, created_at
- **Chat**: id, user_id, question, answer, sources (JSON), created_at
- **Document**: id, title, filename, file_type, upload_date, chunk_count, embedding_id
- **Ticket**: id, customer_name, problem_description, status (open/in_progress/resolved), assigned_engineer_id, priority, created_at, updated_at
- **Feedback**: id, chat_id, user_id, rating (1-5), comment, created_at

**Auth features:**
- JWT access + refresh tokens
- Role-based access control (full RBAC)
- Admin: manage users, all tickets, view all chats
- Engineer: chat, tickets, documents
- Intern: chat only
- Supervisor: chat, tickets (all), view engineer activity
- Password hashing with bcrypt via passlib

---

### Phase 2: AI/RAG Pipeline

**Files to create:**
```
backend/
  ai/
    embeddings.py            # HTML text extraction + chunking + ChromaDB storage
    rag_chain.py             # LangChain RAG chain (query -> vector search -> LLM)
    knowledge_base.py        # Seed script to index concept HTML files
    llm.py                   # OpenAI client wrapper
  services/
    document_service.py      # Upload, process, chunk documents
    chat_service.py          # Chat history, RAG queries
    ticket_service.py        # CRUD for tickets
    report_service.py        # Daily report generation from chat logs
```

**Document processing pipeline:**
1. Parse HTML/PDF/DOCX → extract clean text
2. Split into chunks (~500 tokens, 50 token overlap)
3. Generate embeddings via OpenAI `text-embedding-3-small`
4. Store in ChromaDB with metadata (source file, category)
5. Seed all 27 concept HTML files on startup

**RAG flow:**
1. User question → embedding
2. ChromaDB similarity search (top 5 results)
3. Construct prompt: system prompt + retrieved context + user question
4. Send to OpenAI GPT-4o-mini
5. Return answer + source references

---

### Phase 3: Backend API Routes

**Files to create:**
```
backend/
  api/
    auth.py                  # POST /login, POST /register, POST /refresh
    chat.py                  # POST /chat, GET /chat-history
    documents.py             # POST /upload-document, GET /documents, DELETE /document/{id}
    tickets.py               # POST /create-ticket, GET /tickets, PATCH /tickets/{id}
    reports.py               # POST /generate-report
    feedback.py              # POST /feedback, GET /feedback
    knowledge_base.py        # POST /seed-knowledge-base
```

**Key endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login, get JWT |
| POST | /api/auth/register | Register (admin only) |
| POST | /api/chat | Send question, get AI answer with sources |
| GET | /api/chat/history | Get user's chat history |
| POST | /api/documents/upload | Upload PDF/DOCX/TXT |
| GET | /api/documents | List all documents |
| DELETE | /api/documents/{id} | Delete document |
| POST | /api/tickets | Create ticket |
| GET | /api/tickets | List tickets (filtered by role) |
| PATCH | /api/tickets/{id} | Update ticket status |
| POST | /api/reports/generate | Generate daily report from notes |
| POST | /api/feedback | Submit chat feedback |
| POST | /api/knowledge-base/seed | Index concept files into ChromaDB |

---

### Phase 4: Frontend (Next.js)

**Project setup:**
```
frontend/
  package.json              # Next.js 14, React 18, Tailwind, shadcn/ui
  next.config.js
  tailwind.config.ts
  tsconfig.json
  app/
    layout.tsx              # Root layout with providers
    page.tsx                # Redirect to /chat
    login/
      page.tsx              # Login form
    chat/
      page.tsx              # Main chat interface
    dashboard/
      page.tsx              # Stats dashboard
    documents/
      page.tsx              # Document management
    tickets/
      page.tsx              # Ticket management
  components/
    layout/
      Sidebar.tsx           # Navigation sidebar
      Header.tsx            # Top bar with user info
    chat/
      ChatMessage.tsx       # Message bubble (user/AI)
      ChatInput.tsx         # Text input + send button
      SourceBadge.tsx       # Source reference badge
    ui/                     # shadcn/ui components
      button.tsx
      input.tsx
      card.tsx
      badge.tsx
      dialog.tsx
      dropdown-menu.tsx
      toast.tsx
  hooks/
    useAuth.ts              # Auth state + JWT management
    useChat.ts              # Chat messaging hook
  services/
    api.ts                  # Axios/fetch wrapper with JWT headers
    auth.ts                 # Login/register API calls
    chat.ts                 # Chat API calls
    documents.ts            # Document API calls
    tickets.ts              # Ticket API calls
  lib/
    utils.ts                # cn() helper, formatters
```

**UI Design:**
- Dark theme matching the concept HTML files (#0f172a background, #60a5fa accent)
- Responsive (works on desktop + mobile)
- Chat interface similar to ChatGPT with sidebar history
- Dashboard with stat cards (chats today, documents, tickets, users)
- Document upload with drag-and-drop
- Ticket kanban or table view

---

### Phase 5: Integration, Testing & Polish

**Files to create/update:**
```
matrix-ai/
  README.md                 # Setup instructions
  .gitignore                # Python + Node + env
  start.ps1                 # Windows startup script
  backend/
    seed_knowledge.py       # Standalone script to index concept files
  frontend/
    .env.local              # API URL config
```

**Integration steps:**
1. Verify backend starts: `uvicorn app.main:app --reload`
2. Verify frontend starts: `npm run dev`
3. Seed knowledge base with concept HTML files
4. Test end-to-end: login → chat → get RAG answer → upload doc → create ticket
5. Verify role-based access controls
6. Test report generation

---

## File Count Summary

| Layer | Files to Create | 
|-------|----------------|
| Backend (Python) | ~20 files |
| Frontend (Next.js) | ~25 files |
| Config/Scripts | ~5 files |
| **Total** | **~50 files** |

## Key Decisions
- **No Docker** for now (user runs locally)
- **OpenAI API** for LLM + embeddings
- **Pre-load** 27 concept HTML files into ChromaDB
- **Full RBAC** with 4 roles
- **Windows-friendly** (PowerShell scripts, no bash)
