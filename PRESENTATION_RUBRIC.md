# WildSight AI Presentation Rubric

This rubric is tailored to the current project in this folder: a wildlife camera-trap analysis system with a React frontend, FastAPI backend, animal detection, and species classification.

## Scoring Breakdown (100 points)

| Category | Points | What full marks looks like for this project |
| --- | ---: | --- |
| Problem Framing and Motivation | 20 | The team clearly explains the real-world problem first: camera-trap image review is slow, repetitive, and full of empty frames; researchers need faster wildlife monitoring. The audience understands who benefits, why it matters, and what happens if this problem is not solved. |
| Solution and Technical Approach | 20 | The team explains the system at the right level: upload image, run animal detection, crop detections, classify species, return results in the web app. They connect major tools already in the repo, such as React/Vite, FastAPI, YOLO-based detection, and EfficientNet-based classification, without getting lost in code details. |
| Demo Quality | 20 | A 2 to 3 minute demo works end-to-end using real image input. The team shows at least one positive wildlife example and one empty-frame or low-value example, then shows output such as bounding boxes, species predictions, confidence, or dashboard summary. Backup recording is ready in case the live demo fails. |
| Results and Evaluation | 15 | The presentation shows what the system produces and what was learned. Good evidence includes processed images, detector comparisons, confidence scores, dashboard summaries, or limits observed during testing. The team distinguishes between what is working now and what is still incomplete. |
| Team Contributions | 10 | One slide lists each member by name with specific work owned. The tasks are concrete, such as backend API, frontend upload/results flow, model integration, preprocessing, testing, or presentation prep. Ownership is honest and consistent with Q&A. |
| Organization and Timing | 10 | The talk stays within 15 minutes, follows the required order, and uses 8 to 10 slides. The team spends about 2 slides on the problem, about 3 on approach/techniques, 2 to 3 minutes on demo, 1 slide on contributions, and 1 slide on results/lessons learned. |
| Delivery and Q&A Readiness | 5 | Speakers are clear, transitions are smooth, and answers show real understanding of their own parts. The team can explain tradeoffs, limitations, and next steps without contradicting the demo. |

## Performance Bands

| Level | Score Range | Description |
| --- | ---: | --- |
| Excellent | 90-100 | Problem is convincing, demo is clean, technical explanation is accurate, and team ownership is clear. The audience can quickly understand both impact and implementation. |
| Good | 80-89 | Most required elements are present and clear, with minor gaps in timing, evidence, or depth. Demo and technical story mostly hold together. |
| Satisfactory | 70-79 | The team covers the main sections but the talk feels uneven, rushed, vague, or only partly supported by evidence. |
| Needs Work | Below 70 | The presentation misses required sections, lacks a meaningful demo, has weak ownership, or does not make the problem and solution understandable. |

## Required Slide Order

Use this structure to stay aligned with the posted guidelines.

1. Problem: What camera-trap analysis problem are you solving?
2. Why It Matters: Why researchers or conservation teams care about empty frames, manual review time, and missed wildlife signals.
3. Solution Overview: Show the high-level system flow only.
4. Techniques Used: Detection, classification, preprocessing, frontend/backend integration.
5. System Architecture or Workflow: How data moves through the app.
6. Live Demo: Upload image, process, show detections/classifications.
7. Demo Follow-up: Show dashboard, gallery, or detector comparison if useful.
8. Team Contributions: One honest ownership slide.
9. Results and Lessons Learned: What worked, what failed, what you would improve.

## What To Emphasize For This Repo

- Start with the pain point, not the codebase. The strongest opening is the manual burden of reviewing wildlife camera-trap images.
- Show the two-stage pipeline clearly: detect animals first, then classify species from cropped detections.
- Use the interface already in the repo for the demo flow: upload, process, compare detector outputs, then show results or dashboard summary.
- Include one empty-frame example if possible. That makes the problem and the value of automation more concrete.
- Be explicit about any limits in the current implementation, especially if parts run in demo mode or rely on in-memory session data.

## Common Deductions

- Starting with libraries, model names, or architecture before the audience understands the problem.
- No working demo, or demo uses only screenshots with no real input/output path.
- Contribution slide lists names without specific responsibilities.
- Too many slides, too much code, or running over the 15-minute limit.
- Claiming accuracy, scale, or production readiness without evidence from this project.
- Hiding limitations instead of naming them directly.

## Contribution Slide Template

Replace the placeholders with the actual work each person owned.

| Team Member | Specific Contribution |
| --- | --- |
| Vik | [fill in actual tasks] |
| Osele | [fill in actual tasks] |
| Nate | [fill in actual tasks] |
| Barile | [fill in actual tasks] |
| Max | [fill in actual tasks] |

## Rehearsal Checklist

- Problem is explained before any code, model, API, or architecture slide.
- Demo fits in 2 to 3 minutes and has a backup recording.
- Every speaker can defend the tasks listed beside their name.
- Slides are readable and do not overload the audience with code.
- Results slide includes both strengths and limitations.
- Full presentation fits inside 15 minutes during rehearsal.

## Suggested Self-Assessment

Score yourselves out of 100 before presenting.

- Problem framing: ____ / 20
- Solution and approach: ____ / 20
- Demo quality: ____ / 20
- Results and evaluation: ____ / 15
- Team contributions: ____ / 10
- Organization and timing: ____ / 10
- Delivery and Q&A readiness: ____ / 5

Total: ____ / 100