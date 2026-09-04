// The office's own skills catalogue: work and life skills across every
// sector, not just code. Each is knowledge for the agent's prompt — how to
// do the thing well — never an executable. Seeded by `skills.seed`, which
// upserts by slug, so this file can be edited and re-seeded safely.
//
// Keep prompts short and concrete: what good looks like and what to avoid.

export type SeedSkill = {
  name: string;
  category: SeedCategory;
  description: string;
  prompt: string;
};

export const SEED_CATEGORIES = [
  "Finance",
  "Planning",
  "Problem solving",
  "Emotional",
  "Social",
  "Communication",
  "Research",
  "Coding",
  "Data",
  "Operations",
  "Sales",
  "Marketing",
  "Customer success",
  "Leadership",
  "Learning",
  "Wellbeing",
  "Legal & compliance",
  "Product & design",
  "Life admin",
] as const;

export type SeedCategory = (typeof SEED_CATEGORIES)[number];

const s = (name: string, category: SeedCategory, description: string, prompt: string): SeedSkill => ({
  name,
  category,
  description,
  prompt: prompt.trim(),
});

export const SKILL_SEED: SeedSkill[] = [
  // ---------- Finance ----------
  s("Budgeting", "Finance", "Build and keep a budget that matches money to priorities.", `
- Start from actual past spend, not wishes; group into fixed, variable, and one-off.
- Every line has an owner and a review date. Unowned lines drift.
- Show plan vs actual side by side with the variance and a one-line reason for each gap over 10%.
- Never present a budget without the assumptions it rests on.`),
  s("Cash-flow forecasting", "Finance", "Project cash in and out over the coming weeks and months.", `
- Forecast on timing of cash, not accounting dates: when does money actually land or leave?
- Roll forward weekly for 13 weeks; monthly beyond that.
- Flag the first week the balance dips below the safety floor, and what moves it.
- Keep a best, expected, and worst case; say which one you are showing.`),
  s("Expense tracking", "Finance", "Record, categorise, and reconcile spending.", `
- Capture every transaction with date, amount, payee, category, and a short purpose.
- Reconcile against statements; unexplained differences are findings, not rounding.
- Categories stay small and stable; add one only when a report needs it.
- Summarise monthly: top categories, notable one-offs, trend vs last month.`),
  s("Reading financial statements", "Finance", "Read a P&L, balance sheet, and cash-flow statement and say what they mean.", `
- Read the three statements together; profit without cash is a warning, not a win.
- Compute margins, runway, and growth before commenting on anything else.
- Translate every ratio into a plain sentence a non-finance reader can act on.
- Note what the statements do not show (commitments, seasonality, one-offs).`),
  s("Invoicing & collections", "Finance", "Bill correctly and get paid on time.", `
- An invoice has: what, when, how much, terms, and how to pay. Missing any one delays payment.
- Send the day the work is accepted; chase politely at due date, then at +7 and +14 days.
- Track ageing (0-30, 31-60, 61-90, 90+) and escalate anything past 60.
- Keep the relationship warm; firm on terms, never on tone.`),
  s("Pricing", "Finance", "Set prices that reflect value, cost, and the market.", `
- Anchor on value delivered to the buyer, then check against cost floor and competitor ceiling.
- Offer a small number of clear tiers; complexity kills conversion.
- Test price changes on a segment before rolling out; measure conversion and margin, not just revenue.
- Write down why each price is what it is, so it can be defended and revisited.`),
  s("Cost-benefit analysis", "Finance", "Weigh the costs and benefits of a decision in comparable terms.", `
- Put costs and benefits in the same unit over the same horizon; include time and opportunity cost.
- Separate one-time from recurring; show payback period.
- State the assumption each number depends on and how sensitive the result is to it.
- End with a recommendation and the condition under which it would flip.`),
  s("Investor & stakeholder updates", "Finance", "Write concise periodic updates on money, progress, and asks.", `
- Lead with the headline numbers: cash, runway, revenue, growth, vs last period.
- Then: what worked, what did not, what changed in the plan.
- Make asks explicit and specific (intros, hires, decisions).
- Same structure every time so readers can compare periods at a glance.`),
  s("Personal finance", "Finance", "Manage income, savings, debt, and goals for a household.", `
- Order of operations: emergency buffer, high-interest debt, employer match, then goals.
- Automate transfers on payday; willpower is not a plan.
- Review monthly; adjust yearly. Small consistent moves beat occasional big ones.
- Name each savings pot after its goal and target date.`),

  // ---------- Planning ----------
  s("Goal setting (OKRs)", "Planning", "Turn intentions into measurable objectives and key results.", `
- An objective is a direction in plain words; a key result is a number that proves movement.
- Three to five key results per objective; each has a baseline, target, and date.
- Score honestly at the end; a 0.7 on a stretch goal is success, a 1.0 means it was too easy.
- Tie every project to one objective or question why it exists.`),
  s("Project planning", "Planning", "Break work into a plan with owners, dependencies, and dates.", `
- Define done first, then work backwards into milestones.
- Every task has one owner, an estimate, and what it depends on.
- Put the riskiest, least-understood work first so surprises come early.
- Keep the plan visible and update it when reality moves; a stale plan is worse than none.`),
  s("Prioritisation", "Planning", "Decide what to do first, and what not to do at all.", `
- Rank by impact against effort; when in doubt, ask which item hurts most if delayed a month.
- Say no explicitly; a parked list with dates beats a silent never.
- Limit work in progress; finishing beats starting.
- Re-rank when new information arrives, not on a calendar.`),
  s("Scheduling & time blocking", "Planning", "Lay out time so important work actually happens.", `
- Block deep work in 90-minute stretches; batch shallow work into set windows.
- Put buffers between commitments; back-to-back plans fail on the first overrun.
- Protect the first blocks of the day for the hardest task.
- Review the week on Friday: what slipped, why, and what to move.`),
  s("Risk assessment", "Planning", "Identify what could go wrong, how likely, how bad, and what to do about it.", `
- List risks as "cause leads to effect", not vague worries.
- Score likelihood and impact separately; multiply to rank.
- For each top risk: an owner, a mitigation, and an early warning sign.
- Revisit the register at every milestone; retire what no longer applies.`),
  s("Roadmapping", "Planning", "Sequence initiatives over quarters with reasons.", `
- Themes over features; a roadmap says why before what.
- Now / next / later beats fake precision on dates.
- Every item earns its place with a problem statement and a measure of success.
- Publish the trade-offs: what was cut to make room.`),
  s("Estimation", "Planning", "Estimate effort and duration with honest uncertainty.", `
- Break work down until each piece is under two days; estimate the pieces.
- Give a range, not a point; say what would push it to the high end.
- Compare to something similar already done; reference class beats gut.
- Track estimate vs actual and use the ratio next time.`),
  s("Retrospectives", "Planning", "Look back on work to learn and change something concrete.", `
- Start with the facts and timeline before feelings.
- Ask: what went well, what did not, what surprised us, what we will change.
- Leave with at most three actions, each with an owner and a date.
- Blameless: fix the system that let the mistake happen.`),

  // ---------- Problem solving ----------
  s("Root-cause analysis", "Problem solving", "Find why something happened, not just what.", `
- Write the problem statement with what, where, when, and how much.
- Ask why five times, following evidence, not assumptions.
- Distinguish the trigger from the underlying condition that made it possible.
- Fix the root cause and the detection gap; a patch that hides symptoms recurs.`),
  s("Structured problem solving", "Problem solving", "Break an ambiguous problem into answerable parts.", `
- State the question so a yes or no answer is possible.
- Split into mutually exclusive, collectively exhaustive branches; prune the ones that cannot matter.
- Form a hypothesis early and gather only the evidence that could disprove it.
- Synthesise as an answer first, then the supporting reasoning.`),
  s("Decision making under uncertainty", "Problem solving", "Make good calls without complete information.", `
- Name the decision, the options, and the deadline; indecision is a choice too.
- Ask what is reversible; move fast on reversible calls, slow on one-way doors.
- Assign rough probabilities and costs; the expected-value view removes fear from the maths.
- Record the reasoning at the time so the decision can be judged on process, not just outcome.`),
  s("Systems thinking", "Problem solving", "See the loops and delays behind a behaviour.", `
- Map the stocks, flows, and feedback loops before proposing a fix.
- Look for delays between action and effect; they cause overshoot.
- Ask where the leverage is: rules and goals beat parameters.
- Anticipate second-order effects and who bears them.`),
  s("Creative ideation", "Problem solving", "Generate many options before judging any.", `
- Set a quota (twenty ideas) before evaluating a single one.
- Combine, invert, exaggerate, and borrow from other fields.
- Keep the wild ones; they seed the practical ones.
- Only then converge: cluster, score, and pick two to prototype.`),
  s("Troubleshooting", "Problem solving", "Diagnose a fault methodically.", `
- Reproduce it first; if it cannot be reproduced, gather more before touching anything.
- Change one thing at a time and record the result.
- Bisect: what last worked, what changed since.
- When fixed, explain why the fix works; a fix without a reason will return.`),

  // ---------- Emotional ----------
  s("Self-awareness", "Emotional", "Notice your own state and its effect on your work and others.", `
- Name the feeling before acting on it; naming lowers its grip.
- Know your triggers and your tells; write them down.
- Ask for one piece of feedback a week and sit with it before replying.
- Separate identity from output: a bad draft is not a bad person.`),
  s("Stress management", "Emotional", "Keep functioning well under pressure.", `
- Sort stressors into can-control, can-influence, cannot-touch; act only on the first two.
- Shrink the horizon: the next right step, not the whole mountain.
- Protect sleep, movement, and breaks; they are performance tools, not rewards.
- Say early when load is too high; late is a crisis, early is a plan.`),
  s("Resilience", "Emotional", "Recover from setbacks and keep going.", `
- Treat failure as data: what did it teach, what changes next time.
- Keep a record of past hard things survived; read it when the current one feels unique.
- Rebuild momentum with one small completed task.
- Ask for help before you are stuck, not after.`),
  s("Patience", "Emotional", "Tolerate delay and slow progress without losing quality.", `
- Distinguish slow from stuck; slow needs time, stuck needs a change.
- Set check-in points instead of watching constantly.
- Let others finish their thought and their task before stepping in.
- Compounding needs time; do not pull the plant up to check the roots.`),
  s("Giving & receiving feedback", "Emotional", "Exchange feedback that changes behaviour without damaging trust.", `
- Give it soon, specifically, about the behaviour and its effect, with a request.
- Ask before giving: is now a good time?
- When receiving: listen fully, ask for an example, thank them, decide later.
- Praise in the same specific form; vague praise teaches nothing.`),
  s("Empathy", "Emotional", "Understand what others feel and need, and act on it.", `
- Ask what it is like from their side before proposing anything.
- Reflect back what you heard in your own words and check you got it.
- Assume good intent and a reason you cannot yet see.
- Empathy is not agreement; you can understand fully and still decide differently.`),

  // ---------- Social ----------
  s("Active listening", "Social", "Listen so the other person feels heard and you actually understand.", `
- Stop preparing your reply while they talk.
- Summarise what they said before adding your view.
- Ask open questions: what, how, what else.
- Notice what is not said; the pause often holds the point.`),
  s("Conflict resolution", "Social", "Turn disagreement into a workable outcome.", `
- Separate the people from the problem; attack the issue, not each other.
- Get each side's interests on the table, not just positions.
- Find the shared goal first, then options that serve it.
- Agree on what happens next and when you will check in.`),
  s("Negotiation", "Social", "Reach agreements that hold.", `
- Know your walk-away point and your best alternative before you start.
- Ask more than you tell; the first ten minutes are for learning.
- Trade on what is cheap for you and valuable for them.
- Write the agreement down in the room; memories diverge by tomorrow.`),
  s("Persuasion", "Social", "Move people to a decision honestly.", `
- Start with what they care about, then connect your ask to it.
- One strong reason beats five weak ones.
- Show the evidence and the risk; hiding the downside costs trust later.
- Make the next step small and easy to say yes to.`),
  s("Networking", "Social", "Build and keep useful relationships.", `
- Give first: an intro, an article, a pointer, with no ask attached.
- Follow up within a day with one specific line from the conversation.
- Keep light notes: who, what they care about, when you last spoke.
- Reconnect on a rhythm, not only when you need something.`),
  s("Meeting facilitation", "Social", "Run meetings that decide things.", `
- No agenda, no meeting. Every item has a purpose: decide, inform, or discuss.
- Start on time, restate the goal, end with decisions and owners read aloud.
- Draw out the quiet, park the tangents, name the disagreement.
- Send the notes within the hour.`),
  s("Team collaboration", "Social", "Work well inside a group.", `
- Make your work visible early; surprise is the enemy of trust.
- Ask before assuming; a two-line question saves a two-day rework.
- Give credit by name; take blame as the team.
- Agree on how you will disagree before you need to.`),
  s("Mentoring", "Social", "Help someone grow through guidance, not answers.", `
- Ask what they want to get better at; set one focus at a time.
- Questions before advice: what have you tried, what do you think is going on.
- Share your own mistakes; they teach more than your wins.
- Meet regularly and keep it about them.`),
  s("Delegation", "Social", "Hand work over so it gets done well without you.", `
- Delegate the outcome and the constraints, not the steps.
- Say what done looks like, by when, and how much freedom they have.
- Check in at agreed points, not constantly.
- Keep accountability; delegating the task never delegates the responsibility.`),

  // ---------- Communication ----------
  s("Clear writing", "Communication", "Write so the reader gets it on the first pass.", `
- Lead with the point. Context comes after, not before.
- One idea per sentence, one topic per paragraph; short words over long ones.
- Cut every word that does not carry weight; read it aloud to find them.
- Name things once and keep the name.`),
  s("Executive summaries", "Communication", "Compress a long piece into what a decision maker needs.", `
- First line: the answer or recommendation. Second: why. Third: what you need from them.
- Under 150 words; details go in an appendix with headings.
- Numbers in a small table, not in prose.
- Write it last, after the full piece, then test whether it stands alone.`),
  s("Presenting", "Communication", "Deliver a talk or deck that lands.", `
- One message per slide, one idea per minute; the slide supports you, not the reverse.
- Open with why it matters to this audience; close with the ask.
- Rehearse out loud at least twice; cut a fifth each time.
- Plan for questions; the best ones are the ones you seeded.`),
  s("Storytelling", "Communication", "Use narrative to make ideas stick.", `
- A story has a person, a problem, a turn, and a result. Find all four before telling it.
- Concrete details beat abstractions: the name, the number, the moment.
- Keep the audience's stake in view; it is their story too.
- End on the change, not the summary.`),
  s("Difficult conversations", "Communication", "Say hard things without wrecking the relationship.", `
- Prepare: the facts, your intent, what you want to happen.
- Open with the purpose and the care, then the facts, then the ask.
- Let silence sit; do not fill it by softening the message.
- Close by agreeing what happens next; follow up in writing.`),
  s("Status reporting", "Communication", "Report progress so nobody has to ask.", `
- Three lines: done, doing, blocked. Then dates that moved and why.
- Red, amber, green means something; define it once and be consistent.
- Report risks before they become slips.
- Same format every time so gaps are visible.`),

  // ---------- Research ----------
  s("Web research", "Research", "Find reliable answers online quickly.", `
- Start from the question, not the search box; list what would settle it.
- Prefer primary sources: the paper, the filing, the docs, the announcement.
- Triangulate: two independent sources before you rely on a claim.
- Record the URL, date accessed, and the quote you are relying on.`),
  s("Source evaluation", "Research", "Judge whether a source can be trusted.", `
- Who wrote it, why, when, and what do they gain from you believing it?
- Check whether claims cite something you can follow.
- Distinguish reporting, analysis, and opinion; treat each accordingly.
- Age matters: a solid source can be out of date.`),
  s("Literature review", "Research", "Survey what is already known on a topic.", `
- Define scope and inclusion rules before reading.
- Read abstracts and conclusions first; go deep only on what matters.
- Track sources in a table: claim, method, strength, relevance.
- Synthesise by theme, not by paper; say where the field agrees and where it does not.`),
  s("Interviewing", "Research", "Get honest, useful information from people.", `
- Prepare a short guide of open questions; follow the answers, not the script.
- Ask about specific past behaviour, not hypothetical future intent.
- Silence after an answer draws out the real one.
- Write up within the hour: quotes, surprises, and what you would ask next time.`),
  s("Survey design", "Research", "Ask questions that yield clean data.", `
- One thing per question; no double-barrelled or leading wording.
- Pilot with five people and fix what confused them.
- Keep it short; drop-off rises with every screen.
- Decide the analysis before you write the questions.`),
  s("Competitive analysis", "Research", "Understand alternatives the customer sees.", `
- List competitors the customer would name, not the ones you would.
- Compare on the axes buyers use: price, fit, trust, switching cost.
- Read their reviews and job posts; they reveal roadmap and pain.
- End with implications for you, not a feature table.`),
  s("Fact-checking", "Research", "Verify claims before they go out.", `
- Every number, name, date, and quote gets checked against its source.
- If it cannot be verified, say so or cut it.
- Watch for stale figures repeated across articles; find the original.
- Keep a note of what was checked and where.`),
  s("Note-taking & synthesis", "Research", "Capture information and turn it into understanding.", `
- Write in your own words; copying is not understanding.
- Separate facts, interpretations, and open questions.
- Review notes within a day and pull out the three things that matter.
- Link related notes; knowledge compounds when connected.`),

  // ---------- Coding ----------
  s("Code review", "Coding", "Review changes for correctness, clarity, and risk.", `
- Read the description and tests first, then the diff.
- Look for behaviour changes, edge cases, and what could break in production.
- Comment on the important things; nitpicks go in a batch or a linter.
- Say clearly whether it is approved, needs changes, or needs discussion.`),
  s("Debugging", "Coding", "Find and fix defects systematically.", `
- Reproduce with the smallest possible case.
- Read the error and the stack before guessing.
- Form one hypothesis, test it, and record the result; bisect when unsure.
- Add a test that fails before the fix and passes after.`),
  s("Test writing", "Coding", "Write tests that catch real bugs and stay maintainable.", `
- Test behaviour through the public interface, not implementation details.
- Name each test as a sentence describing the expected behaviour.
- Cover the happy path, the edges, and the failure mode.
- Keep tests independent and fast; a slow suite gets skipped.`),
  s("API design", "Coding", "Design interfaces that are easy to use correctly.", `
- Name things by what they do for the caller.
- Make the common case simple and the wrong case hard.
- Version deliberately; never break callers silently.
- Document with examples that actually run.`),
  s("Refactoring", "Coding", "Improve structure without changing behaviour.", `
- Tests green before and after; refactor in small steps.
- One kind of change per commit: rename, extract, move.
- Leave the code clearer than you found it, not more clever.
- Stop when the goal is reached; refactoring has no natural end.`),
  s("Shell scripting", "Coding", "Automate tasks with reliable scripts.", `
- Fail loudly: set strict mode, check exit codes, quote variables.
- Idempotent scripts can be re-run; design for that.
- Log what the script is doing; silent automation is unfixable.
- Prefer a real language once a script passes fifty lines.`),
  s("Version control", "Coding", "Use git to keep history useful.", `
- Small commits with messages that say why, not what.
- Branch per change; rebase or merge deliberately, never by accident.
- Never rewrite shared history.
- Review the diff before every commit.`),
  s("Technical documentation", "Coding", "Write docs people actually use.", `
- Start with what the reader is trying to do.
- A quick start that works in five minutes, then reference, then concepts.
- Keep examples runnable and tested.
- Date it and say what version it covers.`),

  // ---------- Data ----------
  s("Spreadsheet modelling", "Data", "Build spreadsheets that are correct and legible.", `
- Inputs on one sheet, calculations on another, outputs on a third.
- Colour inputs; never hard-code a number inside a formula.
- Label units and time periods in every header.
- Add checks that sum to zero; a model without checks is a guess.`),
  s("Data cleaning", "Data", "Prepare messy data for analysis.", `
- Profile first: counts, nulls, ranges, duplicates, types.
- Keep raw data untouched; clean into a new table with the steps recorded.
- Decide and document how missing values are handled.
- Validate at the end: totals, row counts, and a spot check against source.`),
  s("Data visualisation", "Data", "Turn numbers into charts that answer a question.", `
- Title the chart with the finding, not the metric.
- Choose the chart for the comparison: bars for categories, lines for time, scatter for relationship.
- Cut gridlines, legends, and colours that do not carry meaning.
- Label directly; a reader should not need to look elsewhere.`),
  s("Basic statistics", "Data", "Describe and compare data without fooling yourself.", `
- Always look at the distribution before the average; medians for skewed data.
- Report the sample size and the spread with every number.
- Correlation is not cause; ask what else could explain it.
- Small differences in small samples are usually noise.`),
  s("SQL querying", "Data", "Pull the right data with clear queries.", `
- Write the question in words first, then the query.
- Select only the columns you need; filter early; join on keys you have verified.
- Check row counts at each step; a silent fan-out is the classic error.
- Comment the intent above any query longer than ten lines.`),
  s("Dashboard design", "Data", "Build dashboards people check and trust.", `
- Five metrics at the top that answer "are we okay?"; details below.
- Every metric has a definition, an owner, and a target.
- Same time ranges and colours everywhere.
- Remove anything nobody looked at last month.`),

  // ---------- Operations ----------
  s("Process documentation", "Operations", "Write down how work is done so it can be repeated.", `
- One process per page: trigger, steps, owner, outputs, exceptions.
- Write from the point of view of someone doing it for the first time.
- Include the why for any step that seems odd.
- Date it and review it when the process changes, not annually.`),
  s("SOP writing", "Operations", "Create standard operating procedures that get followed.", `
- Numbered steps, one action each, in the order they happen.
- Include the checks: how do you know the step worked?
- Screenshots or examples for anything ambiguous.
- Test it by having someone else follow it cold.`),
  s("Vendor management", "Operations", "Choose and manage suppliers well.", `
- Define requirements before talking to vendors.
- Compare on total cost, reliability, and exit cost, not headline price.
- Put service levels and review dates in the contract.
- One owner per vendor; review quarterly.`),
  s("Inventory management", "Operations", "Keep the right stock at the right time.", `
- Track counts, reorder points, and lead times for every item.
- Count regularly; the system is only as good as the last count.
- Watch turnover; slow items tie up cash.
- Plan for seasonality and supplier delays.`),
  s("Quality control", "Operations", "Catch defects before customers do.", `
- Define acceptable in measurable terms.
- Inspect at the points where defects are cheapest to fix.
- Track defect rates by type and cause; fix the top cause first.
- Make it easy to report a problem without blame.`),
  s("Incident handling", "Operations", "Respond to things going wrong calmly and completely.", `
- Stabilise first, understand second, fix third.
- One person coordinates; everyone else executes and reports.
- Communicate on a fixed cadence even when there is no news.
- Write the post-incident review within 48 hours.`),
  s("Logistics & scheduling", "Operations", "Coordinate people, places, and things on time.", `
- Work backwards from the deadline with buffers at every hand-off.
- Confirm every dependency in writing the day before.
- Have a plan B for the two most likely failures.
- Keep one shared timeline that everyone reads from.`),

  // ---------- Sales ----------
  s("Prospecting", "Sales", "Find and qualify people who might buy.", `
- Define the ideal customer in observable terms: size, role, trigger event.
- Personalise the first line; templates are obvious and ignored.
- Qualify on need, authority, budget, and timing before investing time.
- Track every touch; follow-ups win more than first messages.`),
  s("Discovery calls", "Sales", "Understand a prospect's situation before pitching.", `
- Talk less than a third of the time.
- Ask about the problem, its cost, what they have tried, and what happens if nothing changes.
- Do not pitch until you can restate their problem better than they did.
- End with a clear next step and a date.`),
  s("Proposal writing", "Sales", "Write proposals that get signed.", `
- Restate their problem in their words on page one.
- Propose one clear option, with an alternative only if asked.
- Price with scope, timeline, and what is excluded.
- Make signing easy: the next action is obvious.`),
  s("Objection handling", "Sales", "Respond to hesitation without pressure.", `
- Listen fully; restate the objection to confirm you understood.
- Ask what is behind it; the stated objection is rarely the real one.
- Answer with evidence, an example, or an honest "that is a limitation".
- Check whether it is resolved before moving on.`),
  s("Pipeline management", "Sales", "Keep deals moving and forecasts honest.", `
- Every deal has a stage, a next step, a date, and a value.
- Stages are defined by what the buyer has done, not what you have done.
- Review weekly; stale deals get a decision, not another week.
- Forecast from stage conversion history, not optimism.`),
  s("Follow-up cadence", "Sales", "Stay in touch without becoming noise.", `
- Every follow-up adds something: a resource, an answer, a relevant update.
- Space touches: two days, one week, two weeks, then monthly.
- Ask a direct question when the deal stalls; a clear no beats a slow maybe.
- Close the loop when they buy or decline; thank them either way.`),

  // ---------- Marketing ----------
  s("Positioning", "Marketing", "Define who it is for and why it is better.", `
- For whom, what problem, what category, and what makes it different.
- Test the statement on a customer; if they need it explained, it is not done.
- Position against the alternative the buyer actually uses today.
- Keep one positioning across every channel.`),
  s("Copywriting", "Marketing", "Write words that make people act.", `
- Lead with the benefit to them, in their words.
- One idea per headline; specifics beat superlatives.
- Say what to do next in plain language.
- Cut adjectives; add proof.`),
  s("Content planning", "Marketing", "Plan content that serves a goal.", `
- Every piece answers a question a customer actually asks.
- Plan a month ahead with topic, format, owner, date, and distribution.
- Reuse: one long piece becomes several short ones.
- Measure what each piece was meant to do, not just views.`),
  s("SEO basics", "Marketing", "Get found by people searching for what you do.", `
- Target one query per page; match the intent behind it.
- Title, headings, and first paragraph say clearly what the page is about.
- Fast pages, working links, and content worth linking to beat tricks.
- Check what already ranks and be more useful than it.`),
  s("Email campaigns", "Marketing", "Send emails people open and act on.", `
- Subject says what is inside; one message, one action per email.
- Segment: the right message to the right people beats more sends.
- Test subject lines and send times on a slice before the full send.
- Make unsubscribing easy; a clean list performs better.`),
  s("Social media", "Marketing", "Show up consistently where the audience is.", `
- Pick the one or two channels where your people already are.
- Post on a rhythm; consistency beats bursts.
- Reply to comments; distribution rewards conversation.
- Share what is useful or true, not just what is promotional.`),
  s("Brand voice", "Marketing", "Sound like one consistent character everywhere.", `
- Write down three adjectives and three "we never" rules.
- Keep a short list of words to use and to avoid.
- Read new copy aloud against the guide.
- Consistency across support, sales, and marketing builds trust.`),
  s("Marketing analytics", "Marketing", "Know what is working and what is not.", `
- Define the funnel and instrument each stage before spending.
- Attribute cautiously; last-touch flatters the last channel.
- Look at cost per outcome, not per click.
- Kill what does not perform after a fair test; double what does.`),

  // ---------- Customer success ----------
  s("Customer onboarding", "Customer success", "Get new customers to first value quickly.", `
- Define first value and the shortest path to it.
- Remove every step that is not needed to get there.
- Check in at day one, day seven, and day thirty.
- Watch where people stall and fix that step first.`),
  s("Support triage", "Customer success", "Handle incoming requests fairly and fast.", `
- Acknowledge quickly, even before the answer.
- Sort by impact and urgency; note which is which.
- Reproduce before escalating; give engineering the exact steps.
- Close the loop with the customer when it is fixed.`),
  s("Churn analysis", "Customer success", "Understand why customers leave and act early.", `
- Talk to churned customers; the reason is rarely what the data says.
- Find the behaviours that precede churn and watch for them.
- Segment: enterprise and small customers leave for different reasons.
- Fix the top cause; measure whether churn actually moves.`),
  s("Customer interviews", "Customer success", "Learn what customers need from their own mouths.", `
- Ask about their workflow and last week's frustrations, not your product.
- Listen for workarounds; they mark unmet needs.
- Do not sell during the interview.
- Share notes with the team the same day.`),
  s("Escalation management", "Customer success", "Handle an unhappy customer without losing them.", `
- Respond fast, own the problem, and say what happens next and when.
- Get the facts internally before promising anything.
- Over-communicate during the fix.
- After: a written summary, what changed, and a check-in later.`),
  s("Knowledge base writing", "Customer success", "Write help articles that stop tickets.", `
- Title as the question the customer asks.
- Steps with screenshots; expected result after each.
- Link related articles; note what to do if it did not work.
- Review the top-viewed articles monthly against current product.`),

  // ---------- Leadership ----------
  s("Vision setting", "Leadership", "Describe a future people want to build.", `
- Concrete enough to picture, short enough to repeat.
- Say what changes for customers and for the team.
- Connect every big decision back to it out loud.
- Revisit yearly; a vision nobody mentions is decoration.`),
  s("Hiring & interviewing", "Leadership", "Choose people well and fairly.", `
- Write the outcomes the role must deliver before writing the job post.
- Same questions to every candidate; score against defined criteria.
- Ask for specific past examples; probe until you get the detail.
- Decide quickly and tell everyone, including the no's.`),
  s("Performance coaching", "Leadership", "Help people improve at their work.", `
- Agree on expectations in writing; surprises at review time are a leader's failure.
- Focus on one behaviour at a time with a clear example.
- Ask what support they need; then provide it.
- Recognise progress specifically and soon.`),
  s("Running 1:1s", "Leadership", "Hold one-on-ones that people find useful.", `
- Their agenda first; yours second.
- Ask: what is in your way, what should I know, what do you want to grow.
- Keep a running doc; follow up on last time's items.
- Never cancel; reschedule.`),
  s("Change management", "Leadership", "Lead people through change without losing them.", `
- Explain why before what; repeat it more than feels necessary.
- Involve the people affected in designing the how.
- Expect a dip; support through it rather than pretending it will not happen.
- Mark the milestones and celebrate the first wins.`),

  // ---------- Learning ----------
  s("Skill acquisition", "Learning", "Learn new things efficiently.", `
- Define what you will be able to do, then work backwards.
- Practise the hard part deliberately, with feedback, not the whole thing repeatedly.
- Short daily sessions beat long weekly ones.
- Teach it to someone; gaps show up when you explain.`),
  s("Reflection", "Learning", "Turn experience into lessons.", `
- Weekly: what happened, what I learned, what I will do differently.
- Be specific; "communicate better" is not a lesson.
- Keep it where you will read it again.
- Look for patterns across weeks, not single events.`),
  s("Explaining & teaching", "Learning", "Make something clear to someone who does not know it.", `
- Start from what they already know and bridge from there.
- One concept at a time with an example before the definition.
- Check understanding by asking them to apply it, not whether they got it.
- Simplify without saying anything false.`),

  // ---------- Wellbeing ----------
  s("Focus & deep work", "Wellbeing", "Protect attention for work that matters.", `
- Decide the one thing before the day starts.
- Remove inputs during a block: notifications off, one window.
- Work in stretches with real breaks; attention is a muscle.
- Note distractions on paper and deal with them after.`),
  s("Work-life boundaries", "Wellbeing", "Keep work in its place.", `
- Set hours and share them; predictability is respected.
- Have a shutdown ritual: review, plan tomorrow, close.
- Urgent is rarer than it feels; ask what happens if it waits until morning.
- Protect one fully off day a week.`),
  s("Rest & recovery", "Wellbeing", "Recharge so performance holds over time.", `
- Breaks are part of the work, not a reward for finishing it.
- Move during the day; the body carries the mind.
- Take real time off without checking in; the team survives, and learns to.
- Watch for the early signs of burnout and act at the first, not the fifth.`),

  // ---------- Legal & compliance ----------
  s("Contract reading", "Legal & compliance", "Read agreements and spot what matters.", `
- Find the term, the termination, the payment, the liability, and the IP clauses first.
- Read every "notwithstanding" and "except" twice.
- List what you are promising and what they are; check both are things you can live with.
- Anything unclear gets a question before signature, not after.`),
  s("Privacy basics", "Legal & compliance", "Handle personal data responsibly.", `
- Collect only what you need, keep it only as long as you need it.
- Know where personal data lives and who can access it.
- Tell people what you do with their data in plain words.
- Treat a breach as likely: plan the response before it happens.`),
  s("Policy writing", "Legal & compliance", "Write rules that are clear and followable.", `
- Purpose, scope, the rule, the exceptions, who decides, how it is reviewed.
- Plain language; if it needs a lawyer to read, it will not be followed.
- Keep it short and link to procedures for the how.
- Date, version, and owner on every policy.`),

  // ---------- Product & design ----------
  s("User research", "Product & design", "Understand users' goals and pain.", `
- Observe behaviour where you can; ask about it where you cannot.
- Five interviews find most problems; go broad only after.
- Separate what people say from what they do.
- Turn findings into a short list of problems worth solving, ranked.`),
  s("Product spec writing", "Product & design", "Describe what to build and why.", `
- Problem, who has it, evidence, success measure, then the proposal.
- Scope in and scope out, explicitly.
- Open questions listed with owners.
- Short enough to read in ten minutes; link the detail.`),
  s("Wireframing", "Product & design", "Sketch interfaces to test ideas fast.", `
- Boxes and labels; no colour or polish until the flow works.
- Sketch three versions before refining one.
- Walk through the main task step by step; count the clicks.
- Show it to a user before building it.`),
  s("Usability review", "Product & design", "Find where an interface confuses people.", `
- Try the top three tasks as a new user would; note every hesitation.
- Check clarity of labels, visibility of state, and recovery from errors.
- Rank findings by how many users would hit them and how badly.
- Suggest a fix for each, not just the complaint.`),

  // ---------- Life admin ----------
  s("Event planning", "Life admin", "Organise an event that runs smoothly.", `
- Purpose, guests, date, place, budget, in that order.
- Timeline backwards from the day with owners for each task.
- Confirm vendors and headcount a week before; again the day before.
- On the day: one runsheet, one contact list, one person in charge.`),
  s("Travel planning", "Life admin", "Arrange trips with minimal friction.", `
- Book the fixed things first (transport, key lodging), then fill around them.
- Keep all confirmations in one place with times in local zones.
- Build slack between connections.
- Check documents, entry rules, and insurance early.`),
  s("Household administration", "Life admin", "Keep bills, documents, and renewals in order.", `
- A calendar of renewals and due dates with reminders two weeks ahead.
- One folder per area (home, health, money, vehicles); scan everything.
- Automate what repeats; review statements monthly.
- Write down where things are and how they work for anyone who needs it.`),
  s("Meal planning", "Life admin", "Plan food for the week to save time and money.", `
- Plan around what is already in the house and what is on offer.
- Repeat a rotation of reliable meals; novelty is for weekends.
- Shop once with a list grouped by aisle.
- Cook double and freeze half.`),
];
