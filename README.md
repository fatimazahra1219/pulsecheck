
# PulseCheck

**An anonymous classroom feedback tool that helps teachers understand what students are learning — while the lesson is still happening.**

PulseCheck allows teachers to check student understanding through short, anonymous questions called *Pulses*. Students rate their understanding from 1 to 5, and teachers see the results in a live dashboard.

## Features

### Teacher dashboard
- Create classroom sessions with unique six-character join codes.
- Create multiple understanding checks (Pulses) during a lesson.
- Pause, resume, and end individual Pulses.
- End classroom sessions.
- Monitor response counts, average understanding, and score distributions.
- View overall classroom statistics and previous sessions.
- Automatically refresh results every 3 seconds.

### Student experience
- Join a classroom using a code.
- Submit anonymous understanding ratings from 1 to 5.
- Receive new questions automatically without rejoining.
- See when a question has been paused.
- Submit only once per Pulse using a browser-specific anonymous identifier.

### Access control
- Generate a private management key for each classroom.
- Store only the hashed management key in MongoDB.
- Use HTTP-only cookies for teacher authorization.
- Keep student participation separate from teacher management permissions.

## Technology Stack

| Technology | Purpose |
|---|---|
| Next.js 16 (App Router) | Full-stack application |
| React 19 | User interface |
| TypeScript | Type safety |
| Tailwind CSS 4 | Styling |
| MongoDB Atlas | Database |
| Mongoose | Data modeling and database operations |
| Nano ID | Classroom code generation |

## How It Works

1. A teacher creates a classroom and receives a unique six-character code.
2. Students open the student page and enter the classroom code.
3. The teacher creates a Pulse for a particular lesson concept.
4. Students submit a rating from 1 to 5.
5. The teacher monitors the results through the dashboard.
6. The teacher can pause, resume, or end the Pulse.
7. Classroom sessions and their results remain stored in MongoDB for later review.

Results are refreshed using polling every three seconds.

## Getting Started

### Prerequisites

- Node.js and npm
- A MongoDB database (MongoDB Atlas is supported)

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd pulsecheck
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a local environment file from the example:

```bash
cp .env.example .env.local
```

On Windows PowerShell, you can use:

```powershell
Copy-Item .env.example .env.local
```

Open `.env.local` and replace the placeholder with your MongoDB connection string:

```env
MONGODB_URI=your_mongodb_connection_string_here
```

Never commit `.env.local` or share your actual database credentials.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The teacher dashboard is available at `/`, and students can join at `/join`.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create an optimized production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npx tsc --noEmit` | Check TypeScript types |

## Project Structure

```text
pulsecheck/
├── app/
│   ├── api/
│   │   └── sessions/
│   │       └── [code]/
│   │           ├── pulses/
│   │           ├── responses/
│   │           └── results/
│   ├── join/
│   │   └── page.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── layout.tsx
├── lib/
│   ├── models/
│   │   └── Session.ts
│   ├── mongodb.ts
│   └── teacher-auth.ts
├── public/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Current Limitations

- Teacher management currently uses a private key associated with each classroom rather than a full teacher account system.
- Losing the browser's teacher cookie means losing management access to that classroom.
- Student deduplication uses a browser-specific anonymous identifier. Different browsers or cleared browser storage can create another identifier.
- The application has been manually tested, but a dedicated automated test suite has not yet been configured.

## Project Status

**Working MVP — production build verified locally.**

The main classroom, Pulse, student submission, results, and teacher authorization workflows have been implemented and manually tested.

Public deployment has not yet been verified.
