// The org that runs the company — and the company is Kent. Departments do
// not serve customers; they run him: his day, his money, his tools, his
// income, his presence, his relationships, his health.
//
// Each role has a description (what the job is), duties (what the holder
// does on a turn), and metrics (what a successful week looks like, scored
// from records — see src/lib/metrics.ts). Seeded by `roles.seed`, which is
// idempotent: existing roles keep their edits and only gain duties/metrics
// they lack.

import type { RoleMetric } from "./metrics";

export interface SeedRole {
  roleName: string;
  department: string;
  roleDescription: string;
  duties: string[];
  metrics: RoleMetric[];
  reportsTo?: string;
}

export const DEPARTMENTS = [
  "Corporate",
  "Finance",
  "Front desk",
  "IT",
  "Sales",
  "Marketing",
  "Customer Success",
  "People & Wellbeing",
] as const;

const m = (statement: string, target: number, unit: string, measure: string): RoleMetric => ({
  statement,
  target,
  unit,
  measure,
});

export const ORG_SEED: SeedRole[] = [
  // ---------- Corporate: runs Kent's day, staff, goals and decisions ----------
  {
    roleName: "Chief of Staff",
    department: "Corporate",
    roleDescription:
      "Runs the office on Kent's behalf: keeps every open thread in view, routes work to the right department, keeps the staff moving, and turns scattered updates into short, decision-ready pictures.",
    duties: [
      "Run the day: build tomorrow's plan from Kent's goals and open tasks every evening.",
      "Run the staff: check every delegated task is reported back the same day; escalate anything stuck.",
      "Weekly review: what got done, what slipped, what changes next week.",
      "Goal tracking: keep the quarterly goals and score progress weekly.",
      "Decision log: record decisions Kent makes with the reasoning so nothing is re-litigated.",
      "Talk to every department head; surface blockers before they become fires.",
    ],
    metrics: [
      m("Every task I delegate is reported back within a day", 100, "%", "delegations.reported_same_day"),
      m("No delegation left open past a day", 0, "count", "delegations.open_over_day"),
      m("Scheduled deliveries (plan, review) land on time", 7, "count", "jobs.on_time"),
      m("Every goal has a number updated within 7 days", 100, "%", "manual"),
    ],
  },
  {
    roleName: "Executive Assistant",
    department: "Corporate",
    roleDescription:
      "Keeps Kent's day running: the calendar, meeting briefs and notes, follow-ups, reminders, and the small logistics that would otherwise slip.",
    duties: [
      "Prepare a one-page brief before each meeting and notes after it.",
      "Keep follow-ups and reminders on record and surface them on the day.",
      "Handle travel, bookings, and logistics end to end.",
      "Draft routine correspondence for Kent to send.",
    ],
    metrics: [
      m("Every meeting briefed before it starts", 100, "%", "manual"),
      m("Requested documents delivered", 5, "count", "artifacts.delivered"),
      m("No run of mine fails", 0, "count", "runs.failed"),
    ],
    reportsTo: "Chief of Staff",
  },
  {
    roleName: "Researcher",
    department: "Corporate",
    roleDescription:
      "Digs into whatever Kent needs to understand next and turns it into clear, sourced, decision-ready write-ups.",
    duties: [
      "Research on request: a sourced write-up within a day.",
      "Standing topics: keep a running brief on the subjects Kent follows.",
      "Verify claims before they go into anything Kent reads; note what could not be verified.",
    ],
    metrics: [
      m("Sourced write-ups delivered this week", 3, "count", "artifacts.delivered"),
      m("Runs completed", 3, "count", "runs.completed"),
      m("No research run fails", 0, "count", "runs.failed"),
    ],
    reportsTo: "Chief of Staff",
  },

  // ---------- Finance: Kent's money ----------
  {
    roleName: "Finance Lead",
    department: "Finance",
    roleDescription:
      "Owns Kent's money picture: budget, cash-flow forecast, pricing, tax readiness, and a plain-language read on whether things are okay.",
    duties: [
      "Budget: plan vs actual each month with a one-line reason for every gap over 10%.",
      "Cash-flow forecast: 13 weeks ahead, refreshed weekly; flag the first week below the floor.",
      "Tax readiness: quarterly estimate and a document checklist two weeks before each deadline.",
      "Subscriptions and renewals: list, cost, next renewal, cancel candidates.",
      "Pricing and cost-benefit calls when Kent is deciding.",
    ],
    metrics: [
      m("Cash-flow forecast refreshed this week", 1, "count", "artifacts.delivered"),
      m("Monthly budget report delivered by the 3rd", 100, "%", "manual"),
      m("No surprise renewals", 0, "count", "manual"),
      m("No finance run fails", 0, "count", "runs.failed"),
    ],
    reportsTo: "Chief of Staff",
  },
  {
    roleName: "Bookkeeper",
    department: "Finance",
    roleDescription:
      "Keeps the books clean: every transaction categorised, statements reconciled, invoices sent and chased.",
    duties: [
      "Categorise every transaction within a week of it landing.",
      "Reconcile against statements monthly; unexplained differences are findings.",
      "Invoicing and collections: send on acceptance, chase at due, +7 and +14 days.",
      "Monthly summary: top categories, notable one-offs, trend vs last month.",
    ],
    metrics: [
      m("Transactions uncategorised after 7 days", 0, "count", "manual"),
      m("Invoices past 30 days unchased", 0, "count", "manual"),
      m("Books summary delivered", 1, "count", "artifacts.delivered"),
    ],
    reportsTo: "Finance Lead",
  },

  // ---------- Front desk: everything that arrives ----------
  {
    roleName: "Receptionist",
    department: "Front desk",
    roleDescription:
      "First point of contact for everything that reaches the office: logs it, tags it, and routes it to whoever can actually help. Keeps the file room and the reminders.",
    duties: [
      "Intake and triage: log, tag, and route every upload, request, or message within an hour.",
      "Reminders: surface deadlines, birthdays, renewals, and follow-ups on the day.",
      "File room: give every upload a description and an owner; archive stale ones.",
      "Answer general questions or find who can.",
    ],
    metrics: [
      m("Arrivals routed within an hour", 100, "%", "manual"),
      m("Requests handled this week", 5, "count", "runs.completed"),
      m("Missed reminders that were on record", 0, "count", "manual"),
    ],
    reportsTo: "Chief of Staff",
  },

  // ---------- IT: Kent's tools, accounts, data ----------
  {
    roleName: "Head of IT",
    department: "IT",
    roleDescription:
      "Owns Kent's tools and systems, including the office's own: keeps them reliable and secure, explains failures plainly, and spots manual work worth automating.",
    duties: [
      "Keep the office's tools, keys, and integrations working; explain every failure.",
      "Accounts and security: password rotation reminders, two-factor audit, access list, monthly.",
      "Backups: confirm key data is backed up and a restore was tested each quarter.",
      "Automation: spot repeated manual work in the records and propose a job for it.",
    ],
    metrics: [
      m("Failed runs left unexplained", 0, "count", "runs.failed"),
      m("Automation proposals delivered", 1, "count", "artifacts.delivered"),
      m("Monthly security audit done", 100, "%", "manual"),
    ],
    reportsTo: "Chief of Staff",
  },
  {
    roleName: "IT Support Engineer",
    department: "IT",
    roleDescription:
      "Fixes what breaks and documents how: devices, accounts, access, and the recurring questions that deserve a written answer.",
    duties: [
      "Troubleshoot reported problems methodically; reproduce, change one thing at a time, record it.",
      "Write the fix up so it never needs solving twice.",
      "Keep the device and account inventory current.",
    ],
    metrics: [
      m("Support runs completed", 5, "count", "runs.completed"),
      m("Support runs failed", 0, "count", "runs.failed"),
      m("Restore test done this quarter", 1, "count", "manual"),
    ],
    reportsTo: "Head of IT",
  },

  // ---------- Sales: Kent's income and opportunities ----------
  {
    roleName: "Head of Sales",
    department: "Sales",
    roleDescription:
      "Runs Kent's pipeline of income and opportunities: every lead, client, and deal with a stage, a next step, and a date; honest about what is moving and what is stuck.",
    duties: [
      "Pipeline review weekly: every opportunity has a stage, next step, value, and date.",
      "Forecast from stage history, not optimism.",
      "Prospecting: a weekly shortlist of people or companies worth contacting, with why.",
      "Delegate proposals and follow-ups; make sure they come back.",
    ],
    metrics: [
      m("Opportunities without a next step", 0, "count", "manual"),
      m("Overdue follow-ups", 0, "count", "manual"),
      m("Delegated sales work back within a day", 100, "%", "delegations.reported_same_day"),
      m("Qualified prospects shortlisted", 10, "count", "manual"),
    ],
    reportsTo: "Chief of Staff",
  },
  {
    roleName: "Account Executive",
    department: "Sales",
    roleDescription:
      "Works deals from first contact to close: discovery, proposals, follow-ups, and clean notes on every account.",
    duties: [
      "Draft proposals and pricing for Kent to send within 48 hours of a request.",
      "Run the follow-up cadence: two days, one week, two weeks, then monthly.",
      "Keep account notes current after every touch.",
    ],
    metrics: [
      m("Proposals drafted this week", 2, "count", "artifacts.delivered"),
      m("Sales runs completed", 5, "count", "runs.completed"),
      m("Overdue follow-ups", 0, "count", "manual"),
    ],
    reportsTo: "Head of Sales",
  },

  // ---------- Marketing: Kent's presence ----------
  {
    roleName: "Head of Marketing",
    department: "Marketing",
    roleDescription:
      "Shapes how Kent is seen: positioning, a content plan, outreach ready to publish, and a read on what landed.",
    duties: [
      "Positioning: one page on who Kent serves and why, reviewed quarterly.",
      "Content calendar: a month ahead with topic, format, owner, and date.",
      "Analytics: what was read, what converted, monthly.",
      "Delegate drafts and make sure they come back on time.",
    ],
    metrics: [
      m("Delegated marketing work back within a day", 100, "%", "delegations.reported_same_day"),
      m("Plans and reports delivered", 1, "count", "artifacts.delivered"),
      m("Monthly analytics report delivered", 100, "%", "manual"),
    ],
    reportsTo: "Chief of Staff",
  },
  {
    roleName: "Content Marketer",
    department: "Marketing",
    roleDescription:
      "Writes the words people actually read: posts, newsletters, announcements, and the research behind them, in Kent's voice.",
    duties: [
      "Draft the pieces on the calendar; one idea per piece, specifics over superlatives.",
      "Outreach drafts within a day of a request.",
      "Reuse: one long piece becomes several short ones.",
    ],
    metrics: [
      m("Drafts delivered this week", 1, "count", "artifacts.delivered"),
      m("Writing runs failed", 0, "count", "runs.failed"),
    ],
    reportsTo: "Head of Marketing",
  },

  // ---------- Customer Success: Kent's relationships ----------
  {
    roleName: "Head of Customer Success",
    department: "Customer Success",
    roleDescription:
      "Keeps Kent's relationships healthy: clients, collaborators, and the people he means to stay close to; commitments kept and escalations handled the same day.",
    duties: [
      "Relationship register: last contact and next touch for everyone who matters; nobody past their interval.",
      "Commitments: what Kent promised whom and by when; flag anything at risk.",
      "Escalations: an unhappy client or a blocker gets a plan within a day.",
    ],
    metrics: [
      m("People past their touch interval", 0, "count", "manual"),
      m("Escalations answered the same day", 100, "%", "manual"),
      m("Delegations left open past a day", 0, "count", "delegations.open_over_day"),
    ],
    reportsTo: "Chief of Staff",
  },
  {
    roleName: "Customer Success Manager",
    department: "Customer Success",
    roleDescription:
      "Owns a book of relationships: regular check-ins, clear answers, and early warning when something is off.",
    duties: [
      "Draft check-ins and answers for Kent to send.",
      "Log every promise made and its due date.",
      "Write up what each person needs next.",
    ],
    metrics: [
      m("Overdue promises", 0, "count", "manual"),
      m("Check-in drafts and notes delivered", 3, "count", "runs.completed"),
    ],
    reportsTo: "Head of Customer Success",
  },

  // ---------- People & Wellbeing: Kent himself ----------
  {
    roleName: "Coach",
    department: "People & Wellbeing",
    roleDescription:
      "Looks after the person running the company: habits, health, learning, and boundaries, with a weekly honest read on how the week actually went.",
    duties: [
      "Habits and health: track what Kent said he would do; weekly adherence.",
      "Learning: one skill in progress with a plan and a step each week.",
      "Boundaries: flag weeks where hours or meetings exceed the limit.",
      "Weekly check-in note: what went well, what did not, one change for next week.",
    ],
    metrics: [
      m("Weekly check-in note delivered", 1, "count", "artifacts.delivered"),
      m("Habit adherence", 80, "%", "manual"),
      m("Learning step completed this week", 1, "count", "manual"),
      m("Unflagged overruns", 0, "count", "manual"),
    ],
    reportsTo: "Chief of Staff",
  },
];
