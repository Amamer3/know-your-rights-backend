# Know Your Rights Ghana - Backend

A robust Node.js backend for the "Know Your Rights Ghana" platform, designed to empower citizens with legal knowledge and AI-driven situation assessments.

## 🚀 Features

- **Auth System**: Email/Password and Google OAuth integration using Supabase.
- **AI Assessment**: Legal situation analysis using OpenAI GPT-4 with Ghana Constitution context.
- **Voice-to-Text**: Voice-based legal inquiries using OpenAI Whisper.
- **Constitution RAG**: PDF processing and vector-based retrieval for grounded AI responses.
- **Legal Resources**: Searchable database of the Ghana Constitution and emergency actions.
- **Saved Resources**: User capability to save articles and assessments.
- **Automatic Profile Management**: Database triggers to sync Auth users with custom profiles.

## 🛠 Tech Stack

- **Runtime**: Node.js (ES Module)
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI Services**: OpenAI (GPT-4, Whisper)
- **Tools**: `tsx` (Dev), `multer` (File Uploads), `pdf-parse` (PDF extraction)

## 📋 Prerequisites

- Node.js (v18+)
- Supabase Project
- OpenAI API Key

## ⚙️ Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd backends
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory (refer to `.env.example` if available):
   ```env
   PORT=3000
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   OPENAI_API_KEY=your_openai_key
   GOOGLE_REDIRECT_URL=http://localhost:3000/api/auth/callback
   ```

4. **Initialize Database**:
   Run the SQL provided in [supabase_schema.sql](supabase_schema.sql) in your Supabase SQL Editor to set up tables, RLS policies, and triggers.
   Optional: run [scripts/verify-supabase-tables.sql](scripts/verify-supabase-tables.sql) to confirm all five required tables exist.

5. **Seed Emergency Actions**:
   ```bash
   npx tsx src/seed-emergency.ts
   ```

6. **Process Constitution PDF**:
   Upload the constitution PDF via the admin endpoint (using tools like Postman):
   `POST /api/admin/upload` (multipart/form-data with `pdf` field).

## 🏃 Running the Project

- **Development Mode**:
  ```bash
  npm run dev
  ```

- **Build and Production**:
  ```bash
  npm run build
  npm start
  ```

## 🌐 Deployment to Render

This project is configured for easy deployment to [Render](https://render.com/).

### 1. Blueprint Deployment (Recommended)
Render will automatically detect the `render.yaml` file in this repository.
- Connect your GitHub/GitLab repository to Render.
- Choose **Blueprint** when prompted.
- Fill in the required environment variables in the Render dashboard.

### 2. Manual Web Service Setup
If you prefer manual setup:
- **Service Type**: Web Service
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Environment Variables**: Add all variables from your `.env` file.

## 🧪 Testing

A comprehensive test script is provided to verify all API endpoints:
```bash
npx tsx src/test-endpoints.ts
```

## 📚 API Documentation

- Scalar API docs UI: `GET /docs`
- OpenAPI JSON: `GET /openapi.json`

## 📡 API Endpoints

### Authentication
- `POST /api/auth/signup`: Register a new user.
- `POST /api/auth/login`: Login with email/password.
- `GET /api/auth/google`: Initiate Google OAuth.
- `GET /api/auth/callback`: Google OAuth callback.
- `POST /api/auth/logout`: Sign out.
- `POST /api/auth/refresh`: Refresh auth session.
- `POST /api/auth/forgot-password`: Password reset request.

### User
- `GET /api/user/profile`: Get current user profile.
- `PUT /api/user/profile`: Update profile information.
- `DELETE /api/user/account`: Delete user account.

### Legal Resources
- `GET /api/legal/constitution`: List all articles.
- `GET /api/legal/search?query=...`: Search constitution content.
- `GET /api/legal/emergency-actions`: Get emergency contacts and steps.

### AI Assessment
- `POST /api/assess`: Submit situation for AI assessment (supports text or audio file).
- `GET /api/assess/history`: Get user's assessment history.
- `GET /api/assess/:id`: Get detailed assessment.

### Saved Resources
- `POST /api/saved`: Save an article or assessment.
- `GET /api/saved`: List saved resources.
- `DELETE /api/saved/:id`: Remove a saved resource.

### Admin Dashboard (requires admin token)
- `POST /api/admin/bootstrap`: One-time bootstrap for first admin account (requires bearer token + `x-admin-bootstrap-secret` header).
- `GET /api/admin/stats`: Dashboard totals and recent activity.
- `GET /api/admin/users`: List users (`page`, `limit`, `search`).
- `GET /api/admin/users/:userId`: User details with recent activity.
- `PATCH /api/admin/users/:userId`: Update user profile fields.
- `DELETE /api/admin/users/:userId`: Delete user-related data.
- `GET /api/admin/assessments`: List assessments (`page`, `limit`, `userId`).
- `DELETE /api/admin/assessments/:assessmentId`: Remove assessment.
- `GET /api/admin/articles`: List all constitution articles.
- `POST /api/admin/articles`: Create article.
- `PATCH /api/admin/articles/:articleId`: Update article.
- `DELETE /api/admin/articles/:articleId`: Delete article.
- `GET /api/admin/emergency-actions`: List emergency actions.
- `POST /api/admin/emergency-actions`: Create emergency action.
- `PATCH /api/admin/emergency-actions/:actionId`: Update emergency action.
- `DELETE /api/admin/emergency-actions/:actionId`: Delete emergency action.
- `POST /api/admin/upload`: Upload constitution PDF.

Set these in `.env`:
- `ADMIN_BOOTSTRAP_SECRET=your-strong-secret`
- `ADMIN_EMAILS=admin1@example.com,admin2@example.com` (optional allow-list)

Bootstrap flow:
1. Sign in as the user to promote.
2. Call `POST /api/admin/bootstrap` with:
   - `Authorization: Bearer <access_token>`
   - `x-admin-bootstrap-secret: <ADMIN_BOOTSTRAP_SECRET>`
3. Endpoint sets `profiles.preferences.is_admin = true` for that user.

## 📄 License

ISC License.
