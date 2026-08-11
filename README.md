# EDUZONE — Smart Student Dashboard

*Plan smarter. Study better. Win your goals.*

A full‑stack student dashboard: task manager, interactive weekly schedule, and
grade‑goal tracker, behind a real login system — built with **Node.js +
Express**, a **SQLite database**, and vanilla **HTML/CSS/JS** on the front
end (no frameworks, no build step).

## Features

- **Real login system** — accounts stored in SQLite, passwords hashed with
  bcrypt, sessions handled with a signed JWT in an httpOnly cookie. Two-tab
  login/register screen with validation, a password‑strength meter, and a
  "show password" toggle.
- **Dashboard overview** — today's classes, pending tasks, and average goal
  progress at a glance.
- **Tasks** — add, complete, filter (all / pending / done), and delete tasks
  with subject, due date, and priority.
- **Interactive weekly schedule** — a real grid (Sun–Sat × hours), add events
  by day/time/type, colour‑coded by type, click to remove.
- **Grade goals** — set a target grade per subject and drag a slider to
  update current progress; a progress bar shows how close you are.
- **Everything is per‑account** — every task, event, and goal is scoped to
  the logged‑in user in the database.

## Getting started

```bash
npm install
node seed.js     # optional: creates a demo account with sample data
npm start
```

Then open **http://localhost:3000**.

### Demo account
```
email:    demo@eduzone.app
password: demo123
```
(Created by `node seed.js`. Skip that step and just register your own
account if you'd rather start empty.)

## Project structure

```
eduzone/
├── server.js         # Express app + all API routes
├── database.js        # SQLite connection + schema (auto-creates eduzone.db)
├── seed.js             # Optional demo-data script
├── package.json
└── public/
    ├── index.html       # Login / register page
    ├── dashboard.html    # Main app (overview, tasks, schedule, goals)
    ├── css/
    │   ├── style.css       # Shared design tokens & components
    │   ├── auth.css         # Login page layout
    │   └── dashboard.css     # Dashboard layout
    └── js/
        ├── auth.js          # Login/register page logic
        └── dashboard.js     # Dashboard logic + API calls
```

## Database

Uses **SQLite** via `better-sqlite3` — a single file, `eduzone.db`, created
automatically the first time you run the server (no separate database
server to install). Tables: `users`, `tasks`, `schedule`, `goals`. See
`database.js` for the full schema.

## API

All routes below (except register/login) require the auth cookie set on
login/register.

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/register` | Create an account |
| POST | `/api/login` | Log in |
| POST | `/api/logout` | Log out |
| GET | `/api/me` | Current user |
| GET/POST | `/api/tasks` | List / create tasks |
| PATCH/DELETE | `/api/tasks/:id` | Update / delete a task |
| GET/POST | `/api/schedule` | List / create schedule events |
| DELETE | `/api/schedule/:id` | Delete an event |
| GET/POST | `/api/goals` | List / create goals |
| PATCH/DELETE | `/api/goals/:id` | Update / delete a goal |
| GET | `/api/summary` | Dashboard overview numbers |

## Notes for production use

- Set a real `JWT_SECRET` environment variable before deploying.
- Serve over HTTPS so the auth cookie is transmitted safely.
- The color palette (`public/css/style.css`) follows the EDUZONE brand
  brief: Navy `#143051`, Deep Blue `#126A80`, Teal `#169A8D`, Green
  `#20B89A`, on an off‑white `#F8FAFB` background.
