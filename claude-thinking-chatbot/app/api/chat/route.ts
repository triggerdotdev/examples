// import Anthropic from "@anthropic-ai/sdk";
// import { type Message } from "ai";

// // Initialize Anthropic client
// const anthropic = new Anthropic({
//   apiKey: process.env.ANTHROPIC_API_KEY,
// });

// export async function POST(req: Request) {
//   try {
//     const { messages } = await req.json();

//     // Convert messages to Anthropic format
//     const anthropicMessages = messages.map((message: Message) => ({
//       role: message.role === "user" ? "user" : "assistant",
//       content: message.content,
//     }));

//     // Create stream from Anthropic
//     const stream = await anthropic.messages.create({
//       messages: anthropicMessages,
//       model: "claude-3-7-sonnet-20250219",
//       max_tokens: 1024,
//       stream: true,
//     });

//     // Convert the stream to a StreamingTextResponse
//     return new StreamingTextResponse(stream);
//   } catch (error) {
//     console.error("Chat API error:", error);

//     if (error instanceof Error) {
//       const errorMessage = error.message.toLowerCase();

//       if (errorMessage.includes("api key")) {
//         return new Response(JSON.stringify({ error: "API_KEY" }), {
//           status: 401,
//         });
//       }

//       if (errorMessage.includes("rate limit")) {
//         return new Response(JSON.stringify({ error: "RATE_LIMIT" }), {
//           status: 429,
//         });
//       }
//     }

//     return new Response(JSON.stringify({ error: "UNKNOWN" }), { status: 500 });
//   }
// }
