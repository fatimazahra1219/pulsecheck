# PulseCheck

**An anonymous classroom feedback tool that helps teachers understand what students are learning while the lesson is still happening.**

I built PulseCheck to make it easier for teachers to check whether students are following a lesson instead of waiting until a test to discover what they didn't understand.

Teachers can ask short questions, see students answers in a live dashboard, identify possible misunderstandings, and give students activities to work through those difficulties.

The idea is simple: don't just find out that a student doesn't understand something. Try to understand why, help them improve, and check again.

## What can you do with PulseCheck?

### Teacher dashboard

- Create classrooms and share a unique six-character code with students.
- Create multiple understanding checks (Pulses) during a lesson.
- Choose between a quick understanding rating and a multiple-choice Knowledge Check.
- Pause, resume, and end individual Pulses.
- See response counts, average understanding, answer distributions, and confidence levels.
- Identify students who are confident but still choosing incorrect answers.
- View classroom results and previous sessions.
- See results update automatically every three seconds.

### Student experience

- Join a classroom using a code, without creating an account or providing a name.
- Submit an understanding rating from 1 to 5.
- Answer multiple-choice questions and rate their confidence.
- Receive new questions and teacher activities automatically while the student page is open.
- Write and submit answers to activities created by the teacher.
- See when a Pulse is paused or when an activity has ended.

### Classroom activities

When a Knowledge Check reveals a possible misunderstanding, PulseCheck can suggest activities the teacher can use to help students.

Teachers can:

- Choose from suggested activities.
- Edit the title and instructions.
- Add examples or other supporting material.
- Preview the activity before launching it.
- Launch it directly to students.
- Read students written answers, including after the activity has ended.

### Learning Recovery

One of the features I'm particularly interested in is checking whether students improve after an intervention.

A teacher can create a follow-up Knowledge Check and link it to an earlier one.

PulseCheck then compares the answers of students who were initially confident but incorrect.

The dashboard shows:

- How many students were initially confidently incorrect.
- How many completed the follow-up.
- How many answered correctly afterwards.
- How many were still incorrect.
- How many didn't complete the follow-up.
- The recovery percentage among students who completed the follow-up.

This helps teachers get a better picture of whether students are improving after an explanation or activity.

## How it works

1. The teacher creates a classroom and shares its joining code.
2. Students join using the code.
3. The teacher creates a Quick Rating Pulse or a Knowledge Check.
4. Students submit their answers.
5. The teacher watches the results update on the dashboard.
6. When a misunderstanding appears, the teacher can launch an activity.
7. Students complete the activity and submit their answers.
8. The teacher can create a follow-up Knowledge Check to check for improvement.

Classroom sessions, Pulses, and responses are stored in MongoDB, so teachers can review results later.

## Technology

| Technology | What I use it for |
|---|---|
| Next.js 16 | Application and API routes |
| React 19 | User interface |
| TypeScript | Writing and checking the code |
| Tailwind CSS 4 | Styling and responsive layouts |
| MongoDB Atlas | Storing classrooms and student responses |
| Mongoose | Working with MongoDB |
| Nano ID | Generating classroom codes |

## A few things about how it works

- Teachers have a private management key for each classroom.
- The management key is stored as a hash, not as plain text.
- Teacher authorization uses HTTP-only cookies.
- Students don't need accounts or names to participate.
- Student responses are associated with an anonymous browser identifier so the same browser cannot submit multiple answers to the same Pulse or activity.

The browser identifier is not a verified student identity. Using another browser or clearing browser storage can create a new identifier.

## Getting Started

### Requirements

- Node.js
- npm
- A MongoDB database (MongoDB Atlas works)

### 1. Clone the repository

```bash
git clone https://github.com/fatimazahra1219/pulsecheck.git
cd pulsecheck
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the database

Create your local environment file from the example:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Open `.env.local` and add your MongoDB connection string:

```env
MONGODB_URI=your_mongodb_connection_string_here
```

### 4. Start the application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The teacher dashboard is available at `/`, and students can join at `/join`.

## Available Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
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
│   │           ├── results/
│   │           └── ...
│   ├── join/
│   │   └── page.tsx
│   ├── page.tsx
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── i18n/
│   ├── interventions/
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

## Current Status

PulseCheck is a working MVP, and the main classroom, student participation, dashboard, Knowledge Check, intervention, and Learning Recovery features have been implemented.

The application has an earlier deployed version on Vercel:

**[PulseCheck – Live Demo](https://pulsecheck-beta.vercel.app/)**

