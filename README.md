# 🌿 Link Garden

A living, visual bookmark manager. Save links, watch them grow into a garden of plants, and discover your personality through what you browse.

---

## Features

- **Visual garden** — each link category becomes a draggable plant on your dashboard
- **Smart categorization** — links are automatically sorted into categories using AI
- **Personality report** — generate an AI-powered insight into your browsing habits
- **Speech bubbles** — plants occasionally say "visit me" to resurface saved links
- **Scroll animations** — smooth fade-in effects throughout the app

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 19 |
| Styling | Plain CSS |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| AI | Google Gemini (`@google/generative-ai`) |
| Language | JavaScript |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A [Firebase](https://firebase.google.com/) project with Firestore and Authentication enabled
- A [Gemini API key](https://aistudio.google.com/apikey) (free)

---

### 1. Clone the repository

```bash
git clone https://github.com/your-username/link-garden.git
cd link-garden
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the root of the project:

```bash
cp .env.example .env.local
```

Or create it manually and fill in the values:

```env
# Gemini — get your free key at https://aistudio.google.com/apikey
GEMINI_API_KEY=your_gemini_api_key

# Firebase — copy from your Firebase project settings → General → Your apps
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 4. Configure Firebase

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use an existing one)
3. Enable **Firestore Database** — start in production mode
4. Enable **Authentication** → Sign-in method → turn on **Google**
5. Copy your project config from **Project Settings → General → Your apps → Firebase SDK snippet**

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
app/
├── page.js                  # Main garden dashboard
├── report/page.js           # Personality report
├── category/[name]/page.js  # Links panel for each plant
├── link/[id]/page.js        # Individual link detail
├── api/                     # Serverless API routes
│   ├── fetch-metadata/      # Scrapes title & favicon from a URL
│   ├── plant-link/          # Saves a link and assigns it to a category
│   ├── assign-cluster/      # AI categorization
│   ├── get-embedding/       # Generates vector embeddings
│   ├── name-cluster/        # AI-generated category names
│   └── generate-report/     # Generates personality report via Gemini
├── globals.css              # All styles
└── layout.js                # Root layout

components/
└── NavMenu.js               # Navigation menu component

lib/
└── firebase.js              # Firebase initialization

public/                      # Static assets (plant sprites, images)
```

---

## Building for Production

```bash
npm run build
npm start
```
