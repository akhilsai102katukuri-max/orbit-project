import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { questions } = await req.json();
    // questions: Array<{ question_text, expected_answer, given_answer }>

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const results = [];

    for (const q of questions) {
      const prompt = `You are an interview answer evaluator. Compare the candidate's answer against the expected answer.

Question: ${q.question_text}
Expected Answer: ${q.expected_answer}
Candidate's Answer: ${q.given_answer || "(no answer provided)"}

Evaluate the candidate's answer and respond using the provided tool.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are a precise interview answer evaluator. Score answers 0-100 based on relevance, accuracy, and completeness compared to the expected answer." },
            { role: "user", content: prompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "evaluate_answer",
                description: "Return a score and feedback for the candidate's answer",
                parameters: {
                  type: "object",
                  properties: {
                    score: { type: "number", description: "Score from 0 to 100" },
                    feedback: { type: "string", description: "Brief constructive feedback (2-3 sentences max)" },
                  },
                  required: ["score", "feedback"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "evaluate_answer" } },
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.error("AI error:", status, await response.text());
        // Fallback to simple scoring
        results.push({ score: 0, feedback: "AI evaluation unavailable. Please retry." });
        continue;
      }

      const data = await response.json();
      try {
        const toolCall = data.choices[0].message.tool_calls[0];
        const args = JSON.parse(toolCall.function.arguments);
        results.push({
          score: Math.min(100, Math.max(0, Math.round(args.score))),
          feedback: args.feedback,
        });
      } catch {
        results.push({ score: 0, feedback: "Could not parse AI evaluation." });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("score-answer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
