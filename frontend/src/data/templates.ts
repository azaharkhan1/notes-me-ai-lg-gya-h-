// RF Notes Template Library.
// Ships EXACTLY 999 real, unique, ready-to-use templates (featured hand-crafted
// ones + a deterministic generator that composes real archetype structures with
// real domains). Architecture is NOT hard-coded around 999 — more can be added.
// Installing a template clones everything with fresh IDs -> fully independent copy.
import { BlockType } from "@/src/db/pages-types";
import { PropertyType, ViewType } from "@/src/db/workspace-types";
import { genId, nowIso } from "@/src/lib/id";
import { serializeBlockContent } from "@/src/lib/blocks";
import { createPage } from "@/src/db/pages-repo";
import { replacePageBlocks } from "@/src/db/pages-repo";
import {
  addProperty,
  addRecentTemplate,
  addView,
  createEmptyDatabase,
  createRecord,
} from "@/src/db/workspace-store";

export interface TplBlock {
  type: BlockType;
  text?: string;
  checked?: boolean;
  emoji?: string;
}
export interface TplProp {
  name: string;
  type: PropertyType;
  options?: string[];
}
export interface TplDatabase {
  title: string;
  properties: TplProp[];
  records?: Record<string, any>[];
  views?: ViewType[];
}
export interface Template {
  id: string;
  name: string;
  icon: string;
  category: string;
  keywords: string[];
  description: string;
  blocks: TplBlock[];
  databases?: TplDatabase[];
}

// block shortcuts
const h1 = (t: string): TplBlock => ({ type: "h1", text: t });
const h2 = (t: string): TplBlock => ({ type: "h2", text: t });
const h3 = (t: string): TplBlock => ({ type: "h3", text: t });
const p = (t: string): TplBlock => ({ type: "text", text: t });
const b = (t: string): TplBlock => ({ type: "bullet", text: t });
const num = (t: string): TplBlock => ({ type: "numbered", text: t });
const todo = (t: string): TplBlock => ({ type: "checklist", text: t, checked: false });
const quote = (t: string): TplBlock => ({ type: "quote", text: t });
const call = (t: string, emoji = "\uD83D\uDCA1"): TplBlock => ({ type: "callout", text: t, emoji });
const div = (): TplBlock => ({ type: "divider" });

const S = "select";
const D = "date";
const N = "number";
const C = "checkbox";
const TXT = "text";
const TTL = "title";

export const CATEGORIES = [
  "Personal & Life",
  "Productivity",
  "Study & Education",
  "College & University",
  "Goals & Habits",
  "Projects & Work",
  "Business & Startup",
  "Software & Engineering",
  "Finance",
  "Health & Fitness",
  "Content & Creator",
  "Career & Job Search",
  "Travel & Lifestyle",
  "Knowledge & Reading",
];

// ---------------------------------------------------------------------------
// FEATURED hand-crafted templates (kept intact from the original library).
// ---------------------------------------------------------------------------
const FEATURED: Template[] = [
  // ---- Personal & Life ----
  { id: "personal-dashboard", name: "Personal Dashboard", icon: "\uD83C\uDFE0", category: "Personal & Life", keywords: ["home", "overview", "life"], description: "A central hub for your day, tasks and notes.",
    blocks: [h1("Personal Dashboard"), call("Welcome back! Here's your day at a glance."), h2("Today's Focus"), todo("Most important task"), todo("Second priority"), h2("Quick Notes"), p("Jot anything here...")],
    databases: [{ title: "Today's Tasks", properties: [{ name: "Task", type: TTL }, { name: "Status", type: S, options: ["Todo", "In Progress", "Done"] }, { name: "Due", type: D }], views: ["table", "board"], records: [{ Task: "Plan the day", Status: "Todo" }, { Task: "Review inbox", Status: "In Progress" }] }] },
  { id: "daily-journal", name: "Daily Journal", icon: "\uD83D\uDCD3", category: "Personal & Life", keywords: ["journal", "diary", "reflection"], description: "Reflect on your day with guided prompts.",
    blocks: [h1("Daily Journal"), h2("How I feel today"), p(""), h2("Three things that happened"), b(""), b(""), b(""), h2("What I'm grateful for"), p("")] },
  { id: "gratitude-journal", name: "Gratitude Journal", icon: "\uD83D\uDE4F", category: "Personal & Life", keywords: ["gratitude", "thankful"], description: "Cultivate gratitude daily.",
    blocks: [h1("Gratitude Journal"), call("Write 3 things you're grateful for each day."), todo("Grateful for..."), todo("Grateful for..."), todo("Grateful for...")] },
  { id: "life-goals", name: "Life Goals", icon: "\uD83C\uDF1F", category: "Personal & Life", keywords: ["goals", "vision"], description: "Define and track your big life goals.",
    blocks: [h1("Life Goals"), h2("Vision"), p("")],
    databases: [{ title: "Goals", properties: [{ name: "Goal", type: TTL }, { name: "Area", type: S, options: ["Career", "Health", "Relationships", "Finance", "Personal"] }, { name: "Target Date", type: D }, { name: "Progress", type: N }], views: ["table", "board"], records: [{ Goal: "Run a marathon", Area: "Health", Progress: 20 }] }] },
  { id: "morning-routine", name: "Morning Routine", icon: "\u2600\uFE0F", category: "Personal & Life", keywords: ["routine", "morning"], description: "Start every day right.",
    blocks: [h1("Morning Routine"), todo("Drink water"), todo("Stretch / exercise"), todo("Plan the day"), todo("Healthy breakfast")] },

  // ---- Productivity ----
  { id: "daily-planner", name: "Daily Planner", icon: "\uD83D\uDCC5", category: "Productivity", keywords: ["planner", "day"], description: "Plan your day hour by hour.",
    blocks: [h1("Daily Planner"), h2("Top 3 priorities"), todo(""), todo(""), todo(""), h2("Schedule"), p("Morning:"), p("Afternoon:"), p("Evening:")] },
  { id: "weekly-planner", name: "Weekly Planner", icon: "\uD83D\uDCC6", category: "Productivity", keywords: ["planner", "week"], description: "Organize your entire week.",
    blocks: [h1("Weekly Planner"), h2("Goals this week"), todo(""), h2("Mon"), p(""), h2("Tue"), p(""), h2("Wed"), p("")] },
  { id: "todo-list", name: "To-Do List", icon: "\u2705", category: "Productivity", keywords: ["todo", "tasks"], description: "A simple, powerful to-do list.",
    blocks: [h1("To-Do List"), todo("Add your first task"), todo("Add another task")] },
  { id: "priority-matrix", name: "Priority Matrix", icon: "\uD83D\uDD32", category: "Productivity", keywords: ["eisenhower", "priority"], description: "Urgent vs important decision matrix.",
    blocks: [h1("Priority Matrix"), h2("Do first (Urgent + Important)"), todo(""), h2("Schedule (Important)"), todo(""), h2("Delegate (Urgent)"), todo(""), h2("Eliminate")] },
  { id: "gtd", name: "Getting Things Done", icon: "\uD83D\uDCE5", category: "Productivity", keywords: ["gtd", "inbox"], description: "Capture, clarify, organize, engage.",
    blocks: [h1("Getting Things Done"), h2("Inbox"), todo(""), h2("Next Actions"), todo(""), h2("Waiting For"), todo(""), h2("Someday / Maybe")] },

  // ---- Study & Education ----
  { id: "student-dashboard", name: "Student Dashboard", icon: "\uD83C\uDF93", category: "Study & Education", keywords: ["student", "school"], description: "Your academic command center.",
    blocks: [h1("Student Dashboard"), call("Track classes, assignments and exams.")],
    databases: [{ title: "Assignments", properties: [{ name: "Assignment", type: TTL }, { name: "Subject", type: S, options: ["Math", "Science", "History", "English"] }, { name: "Due", type: D }, { name: "Status", type: S, options: ["Todo", "Doing", "Done"] }], views: ["table", "board", "calendar"], records: [{ Assignment: "Essay draft", Subject: "English", Status: "Todo" }] }] },
  { id: "cornell-notes", name: "Cornell Lecture Notes", icon: "\uD83C\uDFAB", category: "Study & Education", keywords: ["lecture", "cornell", "notes"], description: "Cornell-style lecture notes.",
    blocks: [h1("Lecture Notes"), h2("Cues"), b(""), h2("Notes"), p(""), h2("Summary"), p("")] },
  { id: "research-paper", name: "Research Paper", icon: "\uD83D\uDD2C", category: "Study & Education", keywords: ["research", "paper", "sources"], description: "Structure a full research paper.",
    blocks: [h1("Research Paper"), h2("Research Question"), p(""), h2("Abstract"), p(""), h2("Literature Review"), b(""), h2("Methodology"), p(""), h2("Findings"), p(""), h2("References"), b("")] },

  // ---- College & University ----
  { id: "btech-ds-semester", name: "B.Tech Data Science Semester Planner", icon: "\uD83D\uDCBB", category: "College & University", keywords: ["btech", "data science", "semester", "college", "engineering"], description: "Plan a full B.Tech Data Science semester end-to-end.",
    blocks: [h1("B.Tech Data Science Semester Planner"), call("Everything for this semester in one place."), h2("Semester Overview"), p("Semester: "), p("CGPA target: "), h2("Core Subjects"), b("Statistics & Probability"), b("Machine Learning"), b("Data Structures"), b("Database Systems"), h2("Study Plan"), todo("Weekly revision"), todo("Practice problems")],
    databases: [
      { title: "Subjects", properties: [{ name: "Subject", type: TTL }, { name: "Faculty", type: TXT }, { name: "Credits", type: N }, { name: "Grade", type: TXT }], views: ["table"], records: [{ Subject: "Machine Learning", Credits: 4 }, { Subject: "Data Structures", Credits: 4 }] },
      { title: "Assignments & Exams", properties: [{ name: "Item", type: TTL }, { name: "Type", type: S, options: ["Assignment", "Quiz", "Midterm", "Final", "Project"] }, { name: "Due", type: D }, { name: "Status", type: S, options: ["Todo", "In Progress", "Submitted"] }], views: ["board", "table", "calendar"], records: [{ Item: "ML Lab 1", Type: "Assignment", Status: "Todo" }] },
    ] },
  { id: "college-assignment-tracker", name: "College Assignment Tracker", icon: "\uD83D\uDCCB", category: "College & University", keywords: ["college", "assignment", "homework", "deadline"], description: "Never miss a college deadline.",
    blocks: [h1("College Assignment Tracker")],
    databases: [{ title: "Assignments", properties: [{ name: "Assignment", type: TTL }, { name: "Course", type: TXT }, { name: "Due", type: D }, { name: "Status", type: S, options: ["Not started", "In progress", "Submitted"] }, { name: "Grade", type: TXT }], views: ["table", "board", "calendar"], records: [{ Assignment: "Lab report", Status: "Not started" }] }] },

  // ---- Goals & Habits ----
  { id: "habit-tracker", name: "Habit Tracker", icon: "\uD83D\uDD01", category: "Goals & Habits", keywords: ["habit", "streak"], description: "Build habits that stick.",
    blocks: [h1("Habit Tracker"), call("Consistency beats intensity.")],
    databases: [{ title: "Habits", properties: [{ name: "Habit", type: TTL }, { name: "Frequency", type: S, options: ["Daily", "Weekly"] }, { name: "Streak", type: N }, { name: "Done Today", type: C }], views: ["table", "board"], records: [{ Habit: "Read 20 min", Frequency: "Daily", Streak: 3 }] }] },
  { id: "goal-tracker", name: "Goal Tracker (OKR)", icon: "\uD83C\uDFAF", category: "Goals & Habits", keywords: ["goal", "okr"], description: "Track goals and key results.",
    blocks: [h1("Goal Tracker")],
    databases: [{ title: "Goals", properties: [{ name: "Goal", type: TTL }, { name: "Metric", type: TXT }, { name: "Target", type: N }, { name: "Current", type: N }, { name: "Deadline", type: D }], views: ["table", "board"], records: [{ Goal: "Save money", Target: 5000, Current: 1200 }] }] },

  // ---- Projects & Work ----
  { id: "project-dashboard", name: "Project Dashboard", icon: "\uD83D\uDCC1", category: "Projects & Work", keywords: ["project", "dashboard"], description: "Manage a project end-to-end.",
    blocks: [h1("Project Dashboard"), call("Overview, tasks and milestones.")],
    databases: [{ title: "Project Tasks", properties: [{ name: "Task", type: TTL }, { name: "Owner", type: TXT }, { name: "Status", type: S, options: ["Backlog", "In Progress", "Review", "Done"] }, { name: "Due", type: D }], views: ["board", "table", "calendar"], records: [{ Task: "Kickoff", Status: "Done" }, { Task: "Design", Status: "In Progress" }] }] },
  { id: "meeting-notes", name: "Meeting Notes", icon: "\uD83D\uDCC3", category: "Projects & Work", keywords: ["meeting", "notes"], description: "Structured meeting notes.",
    blocks: [h1("Meeting Notes"), p("Date:"), p("Attendees:"), h2("Agenda"), b(""), h2("Notes"), p(""), h2("Action Items"), todo("")] },

  // ---- Business & Startup ----
  { id: "startup-planner", name: "Startup Planner", icon: "\uD83D\uDE80", category: "Business & Startup", keywords: ["startup", "business", "founder"], description: "From idea to launch.",
    blocks: [h1("Startup Planner"), h2("Problem"), p(""), h2("Solution"), p(""), h2("Target Market"), p(""), h2("Business Model"), p(""), h2("Milestones"), todo("MVP"), todo("First 10 users")],
    databases: [{ title: "Tasks", properties: [{ name: "Task", type: TTL }, { name: "Area", type: S, options: ["Product", "Marketing", "Sales", "Ops"] }, { name: "Status", type: S, options: ["Todo", "Doing", "Done"] }], views: ["board", "table"] }] },

  // ---- Software & Engineering ----
  { id: "software-project", name: "Software Project Planner", icon: "\uD83D\uDCBB", category: "Software & Engineering", keywords: ["software", "coding", "project", "dev"], description: "Plan a coding project end-to-end.",
    blocks: [h1("Software Project Planner"), h2("Overview"), p(""), h2("Requirements"), b(""), h2("Features"), todo(""), h2("Decisions"), b("")],
    databases: [
      { title: "Tasks", properties: [{ name: "Task", type: TTL }, { name: "Type", type: S, options: ["Feature", "Bug", "Chore"] }, { name: "Status", type: S, options: ["Backlog", "In Progress", "Review", "Done"] }, { name: "Priority", type: S, options: ["Low", "Medium", "High"] }], views: ["board", "table"], records: [{ Task: "Set up repo", Type: "Chore", Status: "Done" }] },
    ] },

  // ---- Finance ----
  { id: "monthly-budget", name: "Monthly Budget", icon: "\uD83D\uDCB0", category: "Finance", keywords: ["budget", "money"], description: "Plan income and expenses.",
    blocks: [h1("Monthly Budget"), call("Give every dollar a job.")],
    databases: [{ title: "Budget", properties: [{ name: "Item", type: TTL }, { name: "Type", type: S, options: ["Income", "Expense"] }, { name: "Category", type: S, options: ["Rent", "Food", "Transport", "Fun", "Savings"] }, { name: "Amount", type: N }], views: ["table", "board"], records: [{ Item: "Salary", Type: "Income", Amount: 4000 }, { Item: "Rent", Type: "Expense", Category: "Rent", Amount: 1200 }] }] },

  // ---- Health & Fitness ----
  { id: "workout-planner", name: "Workout Planner", icon: "\uD83C\uDFCB\uFE0F", category: "Health & Fitness", keywords: ["workout", "gym"], description: "Plan your training split.",
    blocks: [h1("Workout Planner")],
    databases: [{ title: "Workouts", properties: [{ name: "Day", type: TTL }, { name: "Focus", type: S, options: ["Push", "Pull", "Legs", "Cardio", "Rest"] }, { name: "Exercises", type: TXT }], views: ["table", "board", "calendar"], records: [{ Day: "Monday", Focus: "Push" }] }] },

  // ---- Content & Creator ----
  { id: "content-calendar", name: "Content Calendar", icon: "\uD83D\uDCC5", category: "Content & Creator", keywords: ["content", "calendar"], description: "Plan and schedule content.",
    blocks: [h1("Content Calendar")],
    databases: [{ title: "Content", properties: [{ name: "Title", type: TTL }, { name: "Platform", type: S, options: ["Instagram", "YouTube", "Blog", "X"] }, { name: "Status", type: S, options: ["Idea", "Draft", "Scheduled", "Published"] }, { name: "Publish Date", type: D }], views: ["calendar", "board", "table"], records: [{ Title: "Launch post", Status: "Idea" }] }] },

  // ---- Career & Job Search ----
  { id: "job-search-tracker", name: "Job Search Tracker", icon: "\uD83D\uDCBC", category: "Career & Job Search", keywords: ["job", "career", "applications", "interview"], description: "Track applications and interviews.",
    blocks: [h1("Job Search Tracker"), h2("Target roles"), b("")],
    databases: [{ title: "Applications", properties: [{ name: "Company", type: TTL }, { name: "Role", type: TXT }, { name: "Stage", type: S, options: ["Applied", "Screen", "Interview", "Offer", "Rejected"] }, { name: "Applied", type: D }], views: ["board", "table"], records: [{ Company: "Example Co", Stage: "Applied" }] }] },

  // ---- Travel & Lifestyle ----
  { id: "travel-planner", name: "Travel Planner", icon: "\u2708\uFE0F", category: "Travel & Lifestyle", keywords: ["travel", "trip"], description: "Plan your next adventure.",
    blocks: [h1("Travel Planner"), h2("Destination"), p(""), h2("Budget"), p(""), h2("To book"), todo("Flights"), todo("Hotel")],
    databases: [{ title: "Itinerary", properties: [{ name: "Activity", type: TTL }, { name: "Day", type: D }, { name: "Location", type: TXT }], views: ["calendar", "table"] }] },

  // ---- Knowledge & Reading ----
  { id: "book-tracker", name: "Book Tracker", icon: "\uD83D\uDCDA", category: "Knowledge & Reading", keywords: ["books", "reading"], description: "Track your reading journey.",
    blocks: [h1("Book Tracker")],
    databases: [{ title: "Books", properties: [{ name: "Title", type: TTL }, { name: "Author", type: TXT }, { name: "Status", type: S, options: ["To Read", "Reading", "Finished"] }, { name: "Rating", type: N }, { name: "Finished", type: D }], views: ["gallery", "board", "table"], records: [{ Title: "Atomic Habits", Author: "James Clear", Status: "Reading" }] }] },
  { id: "knowledge-base", name: "Personal Knowledge Base", icon: "\uD83E\uDDE0", category: "Knowledge & Reading", keywords: ["knowledge", "wiki", "zettelkasten"], description: "Your second brain.",
    blocks: [h1("Personal Knowledge Base"), call("Link notes with [[Page]] and @mentions."), h2("Topics"), b("Create a page per topic"), h2("Recent notes"), p("")] },
];

// ---------------------------------------------------------------------------
// GENERATOR: real archetypes x real domains -> unique, usable templates.
// ---------------------------------------------------------------------------
interface Domain { name: string; category: string; kw: string[]; icon: string }

const DOMAINS: Domain[] = [
  // Study & Education
  { name: "Exam Preparation", category: "Study & Education", kw: ["exam", "revision", "test"], icon: "\uD83D\uDCD6" },
  { name: "Semester", category: "Study & Education", kw: ["semester", "term", "school"], icon: "\uD83D\uDDD3\uFE0F" },
  { name: "Study", category: "Study & Education", kw: ["study", "learning"], icon: "\uD83D\uDCDA" },
  { name: "Lecture", category: "Study & Education", kw: ["lecture", "class"], icon: "\uD83C\uDFAB" },
  { name: "Revision", category: "Study & Education", kw: ["revision", "recall"], icon: "\uD83D\uDD01" },
  { name: "Research", category: "Study & Education", kw: ["research", "paper"], icon: "\uD83D\uDD2C" },
  { name: "Thesis", category: "Study & Education", kw: ["thesis", "dissertation"], icon: "\uD83D\uDCDC" },
  { name: "Language Learning", category: "Study & Education", kw: ["language", "vocabulary"], icon: "\uD83D\uDDE3\uFE0F" },
  { name: "Math", category: "Study & Education", kw: ["math", "mathematics"], icon: "\u2795" },
  { name: "Science", category: "Study & Education", kw: ["science", "lab"], icon: "\uD83E\uDDEA" },
  // College & University
  { name: "B.Tech", category: "College & University", kw: ["btech", "engineering", "college"], icon: "\uD83C\uDF93" },
  { name: "B.Tech Data Science", category: "College & University", kw: ["btech", "data science", "ml", "college"], icon: "\uD83D\uDCBB" },
  { name: "Computer Science", category: "College & University", kw: ["cs", "computer science", "college"], icon: "\uD83D\uDDA5\uFE0F" },
  { name: "College", category: "College & University", kw: ["college", "university", "campus"], icon: "\uD83C\uDFEB" },
  { name: "Assignment", category: "College & University", kw: ["assignment", "homework"], icon: "\uD83D\uDCCB" },
  { name: "Internship", category: "College & University", kw: ["internship", "intern"], icon: "\uD83D\uDCBC" },
  { name: "Scholarship", category: "College & University", kw: ["scholarship", "funding"], icon: "\uD83C\uDF93" },
  // AI / ML / Data
  { name: "AI Project", category: "Software & Engineering", kw: ["ai", "artificial intelligence", "ml"], icon: "\uD83E\uDD16" },
  { name: "Machine Learning", category: "Software & Engineering", kw: ["machine learning", "ml", "ai"], icon: "\uD83E\uDDE0" },
  { name: "Data Science", category: "Software & Engineering", kw: ["data science", "data", "analytics"], icon: "\uD83D\uDCCA" },
  { name: "Deep Learning", category: "Software & Engineering", kw: ["deep learning", "neural"], icon: "\uD83E\uDDEC" },
  // Software & Engineering
  { name: "Coding", category: "Software & Engineering", kw: ["coding", "programming", "dev"], icon: "\u2328\uFE0F" },
  { name: "Web Development", category: "Software & Engineering", kw: ["web", "frontend", "backend"], icon: "\uD83C\uDF10" },
  { name: "Mobile App", category: "Software & Engineering", kw: ["mobile", "app", "ios", "android"], icon: "\uD83D\uDCF1" },
  { name: "API", category: "Software & Engineering", kw: ["api", "backend", "integration"], icon: "\uD83D\uDD0C" },
  { name: "DevOps", category: "Software & Engineering", kw: ["devops", "ci", "deployment"], icon: "\u2699\uFE0F" },
  { name: "Open Source", category: "Software & Engineering", kw: ["open source", "github"], icon: "\uD83D\uDC19" },
  { name: "Hackathon", category: "Software & Engineering", kw: ["hackathon", "build"], icon: "\u26A1" },
  { name: "System Design", category: "Software & Engineering", kw: ["system design", "architecture"], icon: "\uD83C\uDFD7\uFE0F" },
  { name: "Bug", category: "Software & Engineering", kw: ["bug", "issue", "debug"], icon: "\uD83D\uDC1B" },
  { name: "Code Review", category: "Software & Engineering", kw: ["code review", "pr"], icon: "\uD83D\uDD0D" },
  // Business & Startup
  { name: "Startup", category: "Business & Startup", kw: ["startup", "founder", "business"], icon: "\uD83D\uDE80" },
  { name: "Business", category: "Business & Startup", kw: ["business", "company"], icon: "\uD83C\uDFE2" },
  { name: "Marketing", category: "Business & Startup", kw: ["marketing", "campaign"], icon: "\uD83D\uDCE3" },
  { name: "Sales", category: "Business & Startup", kw: ["sales", "pipeline", "crm"], icon: "\uD83D\uDCB9" },
  { name: "Product", category: "Business & Startup", kw: ["product", "pm", "roadmap"], icon: "\uD83D\uDCE6" },
  { name: "Freelance", category: "Business & Startup", kw: ["freelance", "client"], icon: "\uD83D\uDCBB" },
  { name: "Client", category: "Business & Startup", kw: ["client", "account"], icon: "\uD83E\uDD1D" },
  { name: "Pitch", category: "Business & Startup", kw: ["pitch", "investor"], icon: "\uD83C\uDFA4" },
  // Projects & Work
  { name: "Project", category: "Projects & Work", kw: ["project", "work"], icon: "\uD83D\uDCC1" },
  { name: "Meeting", category: "Projects & Work", kw: ["meeting", "notes"], icon: "\uD83D\uDCC3" },
  { name: "Team", category: "Projects & Work", kw: ["team", "collaboration"], icon: "\uD83D\uDC65" },
  { name: "Event", category: "Projects & Work", kw: ["event", "planning"], icon: "\uD83C\uDF89" },
  { name: "Launch", category: "Projects & Work", kw: ["launch", "release"], icon: "\uD83D\uDE80" },
  { name: "Sprint", category: "Projects & Work", kw: ["sprint", "agile", "scrum"], icon: "\uD83C\uDFC3" },
  // Productivity
  { name: "Daily", category: "Productivity", kw: ["daily", "day"], icon: "\uD83D\uDCC5" },
  { name: "Weekly", category: "Productivity", kw: ["weekly", "week"], icon: "\uD83D\uDCC6" },
  { name: "Monthly", category: "Productivity", kw: ["monthly", "month"], icon: "\uD83D\uDDD3\uFE0F" },
  { name: "Focus", category: "Productivity", kw: ["focus", "deep work"], icon: "\uD83C\uDFAF" },
  { name: "Task", category: "Productivity", kw: ["task", "todo"], icon: "\u2705" },
  // Goals & Habits
  { name: "Habit", category: "Goals & Habits", kw: ["habit", "streak"], icon: "\uD83D\uDD01" },
  { name: "Goal", category: "Goals & Habits", kw: ["goal", "objective"], icon: "\uD83C\uDFAF" },
  { name: "New Year", category: "Goals & Habits", kw: ["new year", "resolution"], icon: "\uD83C\uDF86" },
  { name: "30-Day Challenge", category: "Goals & Habits", kw: ["challenge", "30 days"], icon: "\uD83D\uDCAA" },
  // Finance
  { name: "Budget", category: "Finance", kw: ["budget", "money"], icon: "\uD83D\uDCB0" },
  { name: "Expense", category: "Finance", kw: ["expense", "spending"], icon: "\uD83D\uDCB8" },
  { name: "Savings", category: "Finance", kw: ["savings", "save"], icon: "\uD83C\uDFE6" },
  { name: "Investment", category: "Finance", kw: ["investment", "stocks", "portfolio"], icon: "\uD83D\uDCC8" },
  { name: "Debt", category: "Finance", kw: ["debt", "loan"], icon: "\uD83D\uDCB3" },
  // Health & Fitness
  { name: "Workout", category: "Health & Fitness", kw: ["workout", "gym", "fitness"], icon: "\uD83C\uDFCB\uFE0F" },
  { name: "Meal", category: "Health & Fitness", kw: ["meal", "food", "diet"], icon: "\uD83C\uDF7D\uFE0F" },
  { name: "Running", category: "Health & Fitness", kw: ["running", "run", "cardio"], icon: "\uD83C\uDFC3" },
  { name: "Yoga", category: "Health & Fitness", kw: ["yoga", "flexibility"], icon: "\uD83E\uDDD8" },
  { name: "Sleep", category: "Health & Fitness", kw: ["sleep", "rest"], icon: "\uD83D\uDE34" },
  { name: "Mental Health", category: "Health & Fitness", kw: ["mental health", "mood"], icon: "\uD83E\uDDE0" },
  // Content & Creator
  { name: "YouTube", category: "Content & Creator", kw: ["youtube", "video"], icon: "\uD83C\uDFAC" },
  { name: "Instagram", category: "Content & Creator", kw: ["instagram", "social"], icon: "\uD83D\uDCF8" },
  { name: "Podcast", category: "Content & Creator", kw: ["podcast", "audio"], icon: "\uD83C\uDFA7" },
  { name: "Blog", category: "Content & Creator", kw: ["blog", "writing"], icon: "\u270D\uFE0F" },
  { name: "Newsletter", category: "Content & Creator", kw: ["newsletter", "email"], icon: "\uD83D\uDCEC" },
  { name: "Writing", category: "Content & Creator", kw: ["writing", "author", "book"], icon: "\uD83D\uDCDD" },
  // Career & Job Search
  { name: "Job Search", category: "Career & Job Search", kw: ["job", "applications"], icon: "\uD83D\uDCBC" },
  { name: "Interview", category: "Career & Job Search", kw: ["interview", "prep"], icon: "\uD83C\uDFA4" },
  { name: "Resume", category: "Career & Job Search", kw: ["resume", "cv"], icon: "\uD83D\uDCC4" },
  { name: "Networking", category: "Career & Job Search", kw: ["networking", "contacts"], icon: "\uD83E\uDD1D" },
  // Travel & Lifestyle
  { name: "Travel", category: "Travel & Lifestyle", kw: ["travel", "trip", "vacation"], icon: "\u2708\uFE0F" },
  { name: "Trip", category: "Travel & Lifestyle", kw: ["trip", "itinerary"], icon: "\uD83D\uDDFA\uFE0F" },
  { name: "Packing", category: "Travel & Lifestyle", kw: ["packing", "checklist"], icon: "\uD83E\uDDF3" },
  { name: "Wedding", category: "Travel & Lifestyle", kw: ["wedding", "event"], icon: "\uD83D\uDC92" },
  { name: "Home", category: "Travel & Lifestyle", kw: ["home", "household"], icon: "\uD83C\uDFE0" },
  { name: "Recipe", category: "Travel & Lifestyle", kw: ["recipe", "cooking"], icon: "\uD83C\uDF73" },
  // Knowledge & Reading
  { name: "Reading", category: "Knowledge & Reading", kw: ["reading", "books"], icon: "\uD83D\uDCDA" },
  { name: "Movie", category: "Knowledge & Reading", kw: ["movie", "film", "watchlist"], icon: "\uD83C\uDFAC" },
  { name: "Course", category: "Knowledge & Reading", kw: ["course", "online learning"], icon: "\uD83C\uDF93" },
  { name: "Note-Taking", category: "Knowledge & Reading", kw: ["notes", "second brain"], icon: "\uD83E\uDDE0" },
  // Personal & Life
  { name: "Journal", category: "Personal & Life", kw: ["journal", "diary"], icon: "\uD83D\uDCD3" },
  { name: "Gratitude", category: "Personal & Life", kw: ["gratitude", "thankful"], icon: "\uD83D\uDE4F" },
  { name: "Self-Care", category: "Personal & Life", kw: ["self care", "wellness"], icon: "\uD83D\uDEC1" },
  { name: "Family", category: "Personal & Life", kw: ["family", "household"], icon: "\uD83D\uDC6A" },
  { name: "Bucket List", category: "Personal & Life", kw: ["bucket list", "dreams"], icon: "\uD83E\uDEA3" },
];

type ArchetypeFn = (d: Domain) => { suffix: string; icon?: string; kw: string[]; description: string; blocks: TplBlock[]; databases?: TplDatabase[] };

const ARCHETYPES: ArchetypeFn[] = [
  (d) => ({ suffix: "Planner", kw: ["planner", "plan"], description: `Plan your ${d.name.toLowerCase()} with goals, schedule and tasks.`,
    blocks: [h1(`${d.name} Planner`), call(`Everything for your ${d.name.toLowerCase()} in one place.`), h2("Goals"), todo("Top goal"), todo("Second goal"), h2("Schedule"), p("This week:"), h2("Tasks"), todo(""), todo(""), h2("Notes"), p("")] }),
  (d) => ({ suffix: "Tracker", icon: "\uD83D\uDCC8", kw: ["tracker", "track"], description: `Track everything about ${d.name.toLowerCase()} in a database.`,
    blocks: [h1(`${d.name} Tracker`), p(`Log and track your ${d.name.toLowerCase()} progress.`)],
    databases: [{ title: `${d.name} Log`, properties: [{ name: d.name, type: TTL }, { name: "Status", type: S, options: ["Todo", "In Progress", "Done"] }, { name: "Priority", type: S, options: ["Low", "Medium", "High"] }, { name: "Date", type: D }], views: ["table", "board", "calendar"], records: [{ [d.name]: `First ${d.name.toLowerCase()} entry`, Status: "Todo" }] }] }),
  (d) => ({ suffix: "Dashboard", icon: "\uD83D\uDCCA", kw: ["dashboard", "overview"], description: `A central ${d.name.toLowerCase()} hub with tasks and overview.`,
    blocks: [h1(`${d.name} Dashboard`), call(`Your ${d.name.toLowerCase()} at a glance.`), h2("Overview"), p(""), h2("Priorities"), todo(""), todo("")],
    databases: [{ title: "Tasks", properties: [{ name: "Task", type: TTL }, { name: "Status", type: S, options: ["Todo", "In Progress", "Done"] }, { name: "Due", type: D }], views: ["board", "table"], records: [{ Task: `Set up ${d.name.toLowerCase()}`, Status: "Todo" }] }] }),
  (d) => ({ suffix: "Checklist", icon: "\u2705", kw: ["checklist", "list"], description: `A ready-to-use ${d.name.toLowerCase()} checklist.`,
    blocks: [h1(`${d.name} Checklist`), h2("Before"), todo("Prepare"), todo("Gather resources"), h2("During"), todo("Execute step by step"), h2("After"), todo("Review"), todo("Follow up")] }),
  (d) => ({ suffix: "Journal", icon: "\uD83D\uDCD3", kw: ["journal", "log", "reflection"], description: `Reflect on your ${d.name.toLowerCase()} with guided prompts.`,
    blocks: [h1(`${d.name} Journal`), h2("Today"), p(""), h2("What went well"), b(""), h2("What to improve"), b(""), h2("Next steps"), todo("")] }),
  (d) => ({ suffix: "Roadmap", icon: "\uD83D\uDDFA\uFE0F", kw: ["roadmap", "milestones", "timeline"], description: `Map milestones and phases for your ${d.name.toLowerCase()}.`,
    blocks: [h1(`${d.name} Roadmap`), h2("Vision"), p(""), h2("Milestones"), todo("Phase 1"), todo("Phase 2"), todo("Phase 3")],
    databases: [{ title: "Phases", properties: [{ name: "Phase", type: TTL }, { name: "Start", type: D }, { name: "End", type: D }, { name: "Status", type: S, options: ["Planned", "Active", "Done"] }], views: ["calendar", "table"] }] }),
  (d) => ({ suffix: "Notes", icon: "\uD83D\uDCDD", kw: ["notes", "summary"], description: `Structured notes for ${d.name.toLowerCase()}.`,
    blocks: [h1(`${d.name} Notes`), h2("Key Points"), b(""), b(""), h2("Details"), p(""), h2("Questions"), b(""), h2("Summary"), p("")] }),
  (d) => ({ suffix: "Review", icon: "\uD83D\uDD0E", kw: ["review", "retrospective"], description: `Run a structured ${d.name.toLowerCase()} review.`,
    blocks: [h1(`${d.name} Review`), h2("What went well"), b(""), h2("What didn't"), b(""), h2("Lessons"), b(""), h2("Action items"), todo("")] }),
  (d) => ({ suffix: "Guide", icon: "\uD83D\uDCD8", kw: ["guide", "steps", "how to"], description: `A step-by-step ${d.name.toLowerCase()} guide.`,
    blocks: [h1(`${d.name} Guide`), p(`Follow these steps for ${d.name.toLowerCase()}.`), num("First step"), num("Second step"), num("Third step"), h2("Tips"), b("")] }),
  (d) => ({ suffix: "Goals", icon: "\uD83C\uDFAF", kw: ["goals", "okr"], description: `Set and track ${d.name.toLowerCase()} goals.`,
    blocks: [h1(`${d.name} Goals`), h2("Vision"), p("")],
    databases: [{ title: "Goals", properties: [{ name: "Goal", type: TTL }, { name: "Target", type: N }, { name: "Current", type: N }, { name: "Deadline", type: D }], views: ["table", "board"], records: [{ Goal: `${d.name} goal`, Target: 100, Current: 0 }] }] }),
  (d) => ({ suffix: "Schedule", icon: "\uD83D\uDDD3\uFE0F", kw: ["schedule", "calendar"], description: `A calendar schedule for ${d.name.toLowerCase()}.`,
    blocks: [h1(`${d.name} Schedule`), p("Plan dates and times below.")],
    databases: [{ title: "Schedule", properties: [{ name: "Item", type: TTL }, { name: "Date", type: D }, { name: "Time", type: TXT }, { name: "Done", type: C }], views: ["calendar", "table"] }] }),
  (d) => ({ suffix: "Kit", icon: "\uD83E\uDDF0", kw: ["kit", "resources", "toolkit"], description: `A complete ${d.name.toLowerCase()} starter kit.`,
    blocks: [h1(`${d.name} Kit`), h2("Resources"), b(""), b(""), h2("Checklist"), todo(""), todo(""), h2("Templates & links"), b("")] }),
];

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function generateTemplates(): Template[] {
  const out: Template[] = [];
  const seen = new Set<string>();
  for (const d of DOMAINS) {
    for (const make of ARCHETYPES) {
      const spec = make(d);
      const name = `${d.name} ${spec.suffix}`;
      const id = `${slug(d.name)}-${slug(spec.suffix)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        name,
        icon: spec.icon || d.icon,
        category: d.category,
        keywords: Array.from(new Set([...d.kw, ...spec.kw, d.name.toLowerCase(), d.category.toLowerCase()])),
        description: spec.description,
        blocks: spec.blocks,
        databases: spec.databases,
      });
    }
  }
  return out;
}

function buildLibrary(): Template[] {
  const map = new Map<string, Template>();
  for (const t of FEATURED) map.set(t.id, t);
  for (const t of generateTemplates()) if (!map.has(t.id)) map.set(t.id, t);
  const all = Array.from(map.values());
  // EXACTLY 999 templates.
  return all.slice(0, 999);
}

export const TEMPLATES: Template[] = buildLibrary();
export const TEMPLATE_COUNT = TEMPLATES.length;

export function templatesByCategory(cat: string): Template[] {
  return TEMPLATES.filter((t) => t.category === cat);
}
export function searchTemplates(q: string): Template[] {
  const s = q.trim().toLowerCase();
  if (!s) return TEMPLATES;
  const terms = s.split(/\s+/).filter(Boolean);
  return TEMPLATES.filter((t) => {
    const hay = `${t.name} ${t.description} ${t.category} ${t.keywords.join(" ")}`.toLowerCase();
    return terms.every((term) => hay.includes(term));
  });
}

// Install a template into a NEW page (fresh IDs -> fully independent copy).
export async function installTemplate(
  tpl: Template,
  parentPageId: string | null = null,
): Promise<string> {
  const ts = nowIso();
  const page = await createPage(parentPageId, { title: tpl.name, icon: tpl.icon });
  const blocks = tpl.blocks.map((tb, i) => ({
    id: genId("blk"),
    pageId: page.id,
    parentBlockId: null,
    type: tb.type,
    content: serializeBlockContent({ text: tb.text, checked: tb.checked, emoji: tb.emoji }),
    depth: 0,
    orderIndex: i,
    createdAt: ts,
    updatedAt: ts,
  }));
  await replacePageBlocks(page.id, blocks as any);

  for (const dbSpec of tpl.databases ?? []) {
    const database = await createEmptyDatabase(page.id, dbSpec.title, "\uD83D\uDDC3\uFE0F");
    const propIdByName: Record<string, string> = {};
    for (let i = 0; i < dbSpec.properties.length; i++) {
      const ps = dbSpec.properties[i];
      const config: any = {};
      if ((ps.type === "select" || ps.type === "multiselect") && ps.options) {
        config.options = ps.options.map((name) => ({ id: genId("opt"), name, color: "gray" }));
      }
      const prop = await addProperty(database.id, ps.name, ps.type as any, config);
      propIdByName[ps.name] = prop.id;
    }
    const views = dbSpec.views && dbSpec.views.length ? dbSpec.views : (["table"] as ViewType[]);
    for (const vt of views) {
      await addView(database.id, vt, vt.charAt(0).toUpperCase() + vt.slice(1), {});
    }
    for (const rec of dbSpec.records ?? []) {
      const values: Record<string, any> = {};
      for (const key of Object.keys(rec)) {
        const pid = propIdByName[key];
        if (pid) values[pid] = rec[key];
      }
      await createRecord(database.id, values);
    }
  }
  await addRecentTemplate(tpl.id);
  return page.id;
}
