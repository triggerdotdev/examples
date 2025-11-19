// import { createClient } from "@supabase/supabase-js";
// import { NextRequest, NextResponse } from "next/server";
// import { randomBytes } from "crypto";

// // Generate unique message ID
// function generateMessageId(): string {
//   return `msg_${randomBytes(8).toString("hex")}`;
// }

// export async function POST(request: NextRequest) {
//   try {
//     const { sessionId, question } = await request.json();

//     console.log("📥 API received chat request:", { sessionId, question });

//     // Validate inputs
//     if (!sessionId || typeof sessionId !== "string") {
//       console.error("❌ Missing sessionId");
//       return NextResponse.json(
//         { error: "Session ID is required" },
//         { status: 400 }
//       );
//     }

//     if (!question || typeof question !== "string") {
//       console.error("❌ Missing question");
//       return NextResponse.json(
//         { error: "Question is required" },
//         { status: 400 }
//       );
//     }

//     // Initialize Supabase client with private key for secure backend communication
//     const supabase = createClient(
//       process.env.SUPABASE_URL!,
//       process.env.SUPABASE_PRIVATE_KEY!,
//       {
//         realtime: {
//           params: {
//             apikey: process.env.SUPABASE_PRIVATE_KEY!, // Explicitly pass the API key
//           },
//         },
//         auth: {
//           persistSession: false,
//         },
//       }
//     );

//     // Create channel for this session with matching configuration
//     const channel = supabase.channel(`session:${sessionId}`, {
//       config: {
//         broadcast: {
//           self: false, // Don't receive own broadcasts
//           ack: true,   // Wait for acknowledgment
//         },
//         private: false, // Use public channel (must match backend configuration)
//       },
//     });
//     const messageId = generateMessageId();

//     console.log("📡 Subscribing to Supabase channel:", `session:${sessionId}`);

//     // Subscribe first
//     await channel.subscribe();

//     console.log("📤 Broadcasting question to channel with messageId:", messageId);

//     // Send question via Supabase Broadcast (control signal only)
//     await channel.send({
//       type: 'broadcast',
//       event: 'question',
//       payload: {
//         question,
//         messageId
//       }
//     });

//     console.log("✅ Question broadcast successful");

//     // Unsubscribe after sending
//     await channel.unsubscribe();

//     // Return the message ID for tracking
//     return NextResponse.json({
//       messageId,
//       sessionId
//     });

//   } catch (error: any) {
//     console.error("Failed to trigger chat task:", error);
//     return NextResponse.json(
//       { error: error.message || "Failed to start chat" },
//       { status: 500 }
//     );
//   }
// }
