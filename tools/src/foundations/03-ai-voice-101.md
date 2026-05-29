# AI Voice 101 — how AI answers the phone

> [!TL;DR] An AI voice agent is software that picks up the phone and has a real conversation: it listens, understands, and talks back in a natural voice. Under the hood it chains three steps — speech-to-text (hears), an AI "brain" (thinks), and text-to-speech (speaks) — fast enough to feel like a person. For a salon, it means missed calls, after-hours calls, and overflow get answered and booked instead of going to voicemail. The catch: it has to be fast, it has to be fed the salon's real info so it doesn't make things up, and it has to know when to hand off to a human.

## 1. What an AI voice agent actually is

An AI voice agent is software that answers (or makes) phone calls and holds a spoken conversation with the caller — no human on the line. The caller talks normally; the agent understands what they want, answers questions, and can take actions like booking an appointment.

Think about where calls go today at a busy salon: the front desk is mid-blowout, it's 9pm and the shop is closed, or three people call at once during a rush. Those calls hit voicemail (most people hang up) or just ring out. An AI voice agent fills exactly those gaps.

> [!WHY IT MATTERS] In service businesses a missed call is often a missed booking — the caller just dials the next salon. The agent's job isn't to replace a great receptionist; it's to make sure no call goes unanswered when a human can't get to it: after-hours, overflow, and missed calls.

| Who answers        | Cost & availability      | Strengths                                                     | Weaknesses                                                                                 |
| ------------------ | ------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Voicemail          | Cheap, always on         | Never misses recording a message                              | Most callers hang up; no booking; you call back later (often too late)                     |
| Human receptionist | Expensive, limited hours | Warm, handles anything, judgment                              | Can't be in two places; sick days; nights/weekends; gets overwhelmed at peak               |
| AI voice agent     | Low cost, 24/7           | Answers instantly, every call, books on the spot, never tired | Needs correct info fed in; struggles with truly unusual requests; hands off the hard stuff |

## 2. The pipeline: hear → think → speak

Most voice agents work as a chain of three stages, often called the **STT → LLM → TTS** pipeline. In plain English: ears, brain, mouth.

> [!HOW IT WORKS] **1) Speech-to-text (STT, also called ASR).** The caller's voice is converted into written words in real time — like live captions on a video.
>
> **2) The AI brain (LLM).** A large language model reads those words, figures out what the caller wants ("she wants a balayage next Saturday afternoon"), decides how to respond, and can trigger actions like checking the calendar.
>
> **3) Text-to-speech (TTS).** The agent's written reply is turned back into a natural-sounding spoken voice and played to the caller.

This loop repeats for every back-and-forth. Newer "speech-to-speech" systems collapse these into one model for lower delay, but the three-stage model is the easiest way to understand any voice agent.

> [!SALON EXAMPLE] A client calls: "Anything for a gel manicure tomorrow morning?" STT writes it down, the brain understands the service and timeframe and checks the booking system, and TTS offers 9:30am or 11am in a friendly voice. The client picks 9:30 and the agent books it — all in one call.

## 3. Why speed (latency) makes or breaks it

**Latency** is the delay between the caller finishing their sentence and the agent starting to reply — the single biggest factor in whether a call feels natural or robotic.

> [!KEY TERM] **Latency** = response delay. In human conversation replies come back within about half a second; sources cite roughly **500ms as the natural benchmark**, with most production agents aiming for a **300–800ms** window (Hamming AI). Longer than that and callers feel awkward dead air — they repeat themselves or assume the call dropped.

Each pipeline stage adds delay and they stack up: rough ranges are STT ~100–500ms, the LLM "thinking" step often the slowest at several hundred ms to over a second, and TTS tens to a couple hundred ms (VideoSDK). The whole loop has to feel instant.

> [!WHY IT MATTERS] You don't need to memorize the millisecond numbers. The takeaway for a sales conversation: a good voice agent answers fast enough that callers often don't realize — or don't mind — that it's AI. A slow, laggy agent is the thing people actually hate.

## 4. Turn-taking and interruptions (barge-in)

Real conversations aren't tidy. People interject, change their mind, or pause to think. A good agent handles this gracefully — knowing when the caller is _done_ versus just pausing, and letting the caller cut in.

> [!KEY TERM] **Barge-in** = the caller can interrupt the agent while it's talking and it stops to listen. **Turn-taking** = deciding whose turn it is to speak. Get this wrong and you get the two classic complaints: "it cut me off" or "it took forever to answer after I stopped talking" (Retell AI).

> [!COMMON MISCONCEPTION] _"AI agents talk over you and feel like an IVR phone tree."_ Modern agents are built specifically to avoid this — they detect when the caller starts speaking and yield the floor, the way a polite person would. It's a different experience from "press 1 for hours, press 2 for booking."

## 5. How a call physically reaches the AI

A salon owner doesn't need telephone engineering — but you should be able to explain the basics confidently.

> [!HOW IT WORKS] The regular phone network is called the **PSTN** (Public Switched Telephone Network) — the system that connects every phone number. AI platforms don't plug into it directly; they use a **telephony provider** (Twilio is the best-known example) that owns phone numbers and bridges calls into software over the internet.
>
> A call reaches the AI one of two simple ways: **(a)** the salon **forwards** its existing number to the agent (e.g., forward to voicemail/AI when unanswered or after hours), or **(b)** the salon **publishes a new number** that rings the agent directly. Either way, the provider streams the live audio to the AI pipeline and streams the AI's voice back to the caller — in both directions, continuously.

> [!KEY TERM] **SIP / SIP trunk** = the internet "pipe" that carries phone calls as data so software can join the call. You'll rarely need this word with an owner, but if a techy customer asks how it connects to their phone line: through a telephony provider over SIP/the internet — no new hardware on their wall.

## 6. How the agent "knows" the right answers (grounding)

An AI brain on its own is a confident generalist — it will happily _guess_ if you let it. That guessing is called **hallucination**, the failure mode owners worry about most ("what if it tells someone the wrong price?").

> [!KEY TERM] **Grounding** = feeding the agent the business's real, current facts (services, prices, hours, staff, policies, live calendar) so answers come from a trusted source, not guesses. The common technique is **RAG** (retrieval-augmented generation): before answering, the agent looks up the real info and answers from that.

> [!WHY IT MATTERS] An **ungrounded** agent invents plausible-sounding nonsense; a **grounded** agent looks up the truth first. Industry reporting claims grounding cuts hallucination dramatically — one source cites a drop from roughly 30–40% to under 6% when answers are tied to real documents (WebProNews). Treat that as directional — but the point holds: **the quality of a voice agent is mostly the quality of the info you feed it.**

> [!SALON EXAMPLE] Asked "how much is a full set of acrylics?", an ungrounded agent might cheerfully make up "$45." A grounded agent pulls the salon's actual price list and says the real number — and if the salon hasn't entered that service, a well-built agent says "let me have someone confirm that for you" instead of inventing it.

## 7. When it should hand off to a human

A good voice agent knows its limits. **Escalation** (transfer or warm handoff) is when the agent passes the caller to a human — and doing this well is a feature, not a failure.

> [!HOW IT WORKS] The agent should hand off when: the caller asks for something outside its knowledge, the caller is upset or insistent on a human, there's a sensitive or unusual situation (a complaint, a refund dispute, a medical/allergy concern), or it simply isn't confident. A **warm transfer** passes along the context so the human doesn't make the caller repeat everything.

> [!RULE OF THUMB] A trustworthy agent would rather say "let me get a team member to help with that" than guess. When you demo to an owner, frame escalation as a safety net: the AI handles the routine 80% (hours, booking, basic questions) and cleanly routes the tricky 20% to a person.

## 8. Common misconceptions and real limitations

> [!COMMON MISCONCEPTION] _"My clients will hate talking to a robot."_ Many callers care more about getting answered instantly at 8pm than about whether a human picked up — especially for simple tasks like booking or checking hours. The alternative they're comparing it to is usually voicemail, which they hate more.

> [!COMMON MISCONCEPTION] _"It'll book things wrong and create chaos."_ Booking errors come mostly from bad setup — wrong hours, missing services, no calendar connection. A grounded agent connected to the real booking system books against real availability. Garbage in, garbage out; good data in, reliable bookings out.

**Honest limitations:** agents can stumble on heavy accents, noisy backgrounds, or rambling/unusual requests; they're only as accurate as the info loaded in; and they aren't a substitute for human warmth on emotionally charged calls. The right pitch is **augmentation, not replacement** — catch the calls a human can't, escalate the rest.

> [!FOR THE AE] Lead with the pain: "How many calls go to voicemail during a busy Saturday — and how many of those callers just book somewhere else?" Then position the agent as the safety net that answers those and books them. Pre-empt the two objections (clients hate robots / it'll book wrong) with the framing above, and emphasize that **setup quality** — real hours, services, prices, calendar connection — is what makes it reliable. Sell the safety net, not a sci-fi robot.

## Key terms

| Term                       | Plain-English meaning                                                        |
| -------------------------- | ---------------------------------------------------------------------------- |
| AI voice agent             | Software that answers/makes calls and talks with the caller, no human needed |
| STT / ASR                  | Speech-to-text: turns the caller's spoken words into written text            |
| LLM                        | The AI "brain" that understands the request and decides how to respond       |
| TTS                        | Text-to-speech: turns the agent's reply into a natural spoken voice          |
| Latency                    | The delay before the agent replies; lower = more natural                     |
| Barge-in                   | The caller can interrupt the agent and it stops to listen                    |
| Turn-taking                | Knowing whose turn it is to talk and when the caller is finished             |
| PSTN                       | The regular public phone network that connects all phone numbers             |
| Telephony provider         | A service (e.g., Twilio) that bridges phone calls into software              |
| SIP / SIP trunk            | The internet "pipe" that carries calls as data so software can join          |
| Grounding                  | Feeding the agent real business info so answers are factual, not guessed     |
| RAG                        | A method where the agent looks up real info before answering                 |
| Hallucination              | When an AI confidently makes up a wrong answer                               |
| Escalation / warm transfer | Handing the caller off to a human, with context                              |

## Sources

- [Voice to Text LLM Model 2025 — VideoSDK](https://www.videosdk.live/developer-hub/llm/voice-to-text-llm-model)
- [Speech-to-Speech (STS) Pipeline: How Modern Voice Agents Work — Medium](https://medium.com/@ayushazhar/speech-to-speech-sts-pipeline-how-modern-voice-agents-work-7a990c982b71)
- [Voice AI Latency: What's Fast, What's Slow, and How to Fix It — Hamming AI](https://hamming.ai/resources/voice-ai-latency-whats-fast-whats-slow-how-to-fix-it)
- [AI Voice Agent Latency Face-Off 2025 — Retell AI](https://www.retellai.com/resources/ai-voice-agent-latency-face-off-2025)
- [Turn-Taking in Conversational AI — CallSphere](https://callsphere.ai/blog/turn-taking-conversational-ai-natural-voice-interactions)
- [Core Latency in AI Voice Agents — Twilio](https://www.twilio.com/en-us/blog/developers/best-practices/guide-core-latency-ai-voice-agents)
- [Programmable Voice — Twilio](https://www.twilio.com/en-us/voice)
- [How to create a phone-based voice agent (2026 guide) — AssemblyAI](https://www.assemblyai.com/blog/how-to-create-phone-based-voice-agent)
- [SIP Trunking for AI Voice Agents — SIPSymposium](https://sipsymposium.com/guides/sip-trunking-for-ai-agents)
- [Safety, Hallucinations, and Guardrails for Voice AI — Gladia](https://www.gladia.io/blog/voice-ai-hallucinations)
- [The Ultimate Guide to AI Hallucinations in Voice Agents — Retell AI](https://www.retellai.com/blog/the-ultimate-guide-to-ai-hallucinations-in-voice-agents-and-how-to-mitigate-them)
- [Mitigating Hallucinations in RAG Systems — WebProNews](https://www.webpronews.com/mitigating-hallucinations-in-rag-systems-for-reliable-ai/)
