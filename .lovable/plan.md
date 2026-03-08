
## Changes to Make

Here are the 4 fixes requested, with no other changes:

---

### 1. Remove "Live Interviews" from Company Sidebar

In `src/components/AppSidebar.tsx`, remove the `{ title: "Live Interviews", url: "/interviews", icon: CalendarDays }` entry from the `items` array and remove the unused `CalendarDays` import.

---

### 2. Speech-to-Text (Voice Answers) in Interviewee Session

In `src/pages/IntervieweeSession.tsx`, replace the text `<Textarea>` with a **record button** that uses the browser's built-in **Web Speech API** (`SpeechRecognition`) — no external API key required. This is free, built into all modern browsers, and works instantly.

How it works:
- A "Start Recording" / "Stop Recording" button appears for each question
- While recording, the microphone icon pulses red
- Spoken words are converted to text in real-time and displayed in a read-only text area
- The recognized text is saved as the answer for that question
- The existing scoring algorithm already compares text, so scores work as-is

---

### 3. Remove Interview from Interviewee List After Completion

Currently, after an interviewee submits their responses, the interview still shows in their dashboard. 

Fix: In `IntervieweeDashboard.tsx`, after fetching interviews and the user's own responses, filter out any interview where the user has already submitted a response for at least one of its questions. This requires:
- Fetching question IDs for each interview
- Checking if the user has any responses for those questions
- Only showing interviews the user has **not yet completed**

Implementation: Fetch `interview_questions` for all interviews, then cross-reference with `my_responses`. If any response exists for a question belonging to an interview → hide that interview from the "Available" list.

---

### 4. Fix "Completed Sessions" Count Not Increasing

**Root Cause:** When an interviewee submits, only `interviewee_responses` rows are inserted. The `interviews` table `status` column is never updated from `'upcoming'` to `'completed'`. So the company dashboard's `completed` filter (`i.status === 'completed'`) returns nothing.

Fix: In `IntervieweeSession.tsx`'s `handleSubmit` function, after successfully inserting responses, also call:
```typescript
await supabase.from("interviews").update({ status: "completed" }).eq("id", interviewId);
```
This marks the interview as completed in the database, so the company dashboard's count reflects reality.

---

### Technical Summary of File Changes

| File | Change |
|---|---|
| `src/components/AppSidebar.tsx` | Remove "Live Interviews" nav item |
| `src/pages/IntervieweeSession.tsx` | Replace Textarea with Web Speech API voice recording UI |
| `src/pages/IntervieweeDashboard.tsx` | Filter out already-completed interviews from interviewee's list |
| `src/pages/IntervieweeSession.tsx` | On submit, update interview status to "completed" in DB |

No database schema changes needed. No other files will be touched.
