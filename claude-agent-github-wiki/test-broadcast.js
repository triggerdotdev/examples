// Test Supabase broadcast functionality
const { createClient } = require("@supabase/supabase-js");

async function test() {
  console.log("Testing Supabase broadcast...\n");

  // Using environment variables
  const SUPABASE_URL =
    process.env.SUPABASE_URL || "https://rnxcjullrjwhgtdbpqbp.supabase.co";
  const SERVICE_KEY = process.env.SUPABASE_PRIVATE_KEY;
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SERVICE_KEY || !ANON_KEY) {
    console.error("Missing keys in environment!");
    process.exit(1);
  }

  console.log("1. Creating backend client (service role)...");
  const backendClient = createClient(SUPABASE_URL, SERVICE_KEY);

  console.log("2. Creating frontend client (anon)...");
  const frontendClient = createClient(SUPABASE_URL, ANON_KEY);

  const testChannel = "test-broadcast-channel";

  // Backend listens
  console.log("\n3. Backend subscribing to channel:", testChannel);
  const backendChannel = backendClient.channel(testChannel);

  backendChannel.on("broadcast", { event: "test" }, (payload) => {
    console.log("✅ Backend received broadcast:", payload);
  });

  await new Promise((resolve, reject) => {
    backendChannel.subscribe((status) => {
      console.log("Backend subscription status:", status);
      if (status === "SUBSCRIBED") {
        resolve();
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
        reject(new Error(`Backend subscription failed: ${status}`));
      }
    });
  });

  // Frontend sends
  console.log("\n4. Frontend subscribing to same channel...");
  const frontendChannel = frontendClient.channel(testChannel);

  await new Promise((resolve, reject) => {
    frontendChannel.subscribe((status) => {
      console.log("Frontend subscription status:", status);
      if (status === "SUBSCRIBED") {
        resolve();
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
        reject(new Error(`Frontend subscription failed: ${status}`));
      }
    });
  });

  console.log("\n5. Frontend sending broadcast...");
  const result = await frontendChannel.send({
    type: "broadcast",
    event: "test",
    payload: { message: "Hello from frontend!" },
  });

  console.log("Send result:", result);

  // Wait for message
  console.log("\n6. Waiting 2 seconds for message...");
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log("\nTest complete!");
  process.exit(0);
}

test().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
