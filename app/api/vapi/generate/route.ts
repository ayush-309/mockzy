import { generateText, generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

const interviewDetailsSchema = z.object({
  role: z.string(),
  type: z.enum(["Technical", "Behavioral", "Mixed"]),
  level: z.enum(["Junior", "Mid-level", "Senior"]),
  techstack: z.string(),
  amount: z.number().min(5).max(15),
});

export async function POST(request: Request) {
  const body = await request.json();

  try {
    // Check if this is a direct interview generation (old format) or conversation-based
    if (body.conversationText) {
      // New approach: Extract details from conversation
      const { conversationText, userid } = body;

      // Step 1: Extract interview details from the conversation
      const { object: interviewDetails } = await generateObject({
        model: google("gemini-2.0-flash-001"),
        schema: interviewDetailsSchema,
        prompt: `Analyze the following conversation between an AI assistant and a user who is setting up a mock interview. Extract the interview details:

Conversation:
${conversationText}

Extract:
- role: The job role/position (e.g., "Frontend Developer")
- type: The interview type - must be one of: "Technical", "Behavioral", or "Mixed"
- level: The experience level - must be one of: "Junior", "Mid-level", or "Senior"
- techstack: Comma-separated list of technologies (e.g., "React, Node.js, MongoDB")
- amount: Number of questions (between 5 and 15)

If any information is missing or unclear, use reasonable defaults:
- type: "Mixed"
- level: "Mid-level"
- amount: 10`,
      });

      // Step 2: Generate interview questions based on extracted details
      const { text: questions } = await generateText({
        model: google("gemini-2.0-flash-001"),
        prompt: `Prepare questions for a job interview.
          The job role is ${interviewDetails.role}.
          The job experience level is ${interviewDetails.level}.
          The tech stack used in the job is: ${interviewDetails.techstack}.
          The focus between behavioural and technical questions should lean towards: ${interviewDetails.type}.
          The amount of questions required is: ${interviewDetails.amount}.
          Please return only the questions, without any additional text.
          The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
          Return the questions formatted like this:
          ["Question 1", "Question 2", "Question 3"]
          
          Thank you! <3
      `,
      });

      // Step 3: Save the interview to Firestore
      const interview = {
        role: interviewDetails.role,
        type: interviewDetails.type,
        level: interviewDetails.level,
        techstack: interviewDetails.techstack.split(",").map((tech) => tech.trim()),
        questions: JSON.parse(questions),
        userId: userid,
        finalized: true,
        coverImage: getRandomInterviewCover(),
        createdAt: new Date().toISOString(),
      };

      await db.collection("interviews").add(interview);

      return Response.json({ success: true }, { status: 200 });
    } else {
      // Old approach: Direct parameters (for backward compatibility or webhook)
      const { type, role, level, techstack, amount, userid } = body;

      const { text: questions } = await generateText({
        model: google("gemini-2.0-flash-001"),
        prompt: `Prepare questions for a job interview.
          The job role is ${role}.
          The job experience level is ${level}.
          The tech stack used in the job is: ${techstack}.
          The focus between behavioural and technical questions should lean towards: ${type}.
          The amount of questions required is: ${amount}.
          Please return only the questions, without any additional text.
          The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
          Return the questions formatted like this:
          ["Question 1", "Question 2", "Question 3"]
          
          Thank you! <3
      `,
      });

      const interview = {
        role: role,
        type: type,
        level: level,
        techstack: techstack.split(","),
        questions: JSON.parse(questions),
        userId: userid,
        finalized: true,
        coverImage: getRandomInterviewCover(),
        createdAt: new Date().toISOString(),
      };

      await db.collection("interviews").add(interview);

      return Response.json({ success: true }, { status: 200 });
    }
  } catch (error) {
    console.error("Error:", error);
    return Response.json({ success: false, error: error }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ success: true, data: "Thank you!" }, { status: 200 });
}
