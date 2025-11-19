import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

async function testSupabase() {
  console.log("\n🔍 Testing Supabase Connection\n");
  console.log("================================\n");

  // Check environment variables
  const url = process.env.SUPABASE_URL;
  const privateKey = process.env.SUPABASE_SECRET_KEY;

  console.log("Environment Check:");
  console.log(
    "SUPABASE_URL:",
    url ? `✅ ${url.substring(0, 40)}...` : "❌ NOT SET"
  );
  console.log(
    "SUPABASE_SECRET_KEY:",
    privateKey ? `✅ ${privateKey.substring(0, 20)}...` : "❌ NOT SET"
  );
  console.log("");

  if (!url || !privateKey) {
    console.error("❌ Missing required environment variables!");
    console.log("\nMake sure your .env file contains:");
    console.log("SUPABASE_URL=https://YOUR_PROJECT.supabase.co");
    console.log("SUPABASE_SECRET_KEY=your-service-role-key-here\n");
    process.exit(1);
  }

  // Test 1: Create client with private key
  console.log("📡 Test 1: Creating Supabase client with private key...");

  const supabase = createClient(url, privateKey, {
    realtime: {
      params: {
        apikey: privateKey,
        eventsPerSecond: 10,
      },
      timeout: 60000,
    },
    auth: {
      persistSession: false,
    },
  });

  // Test 2: Try to subscribe to a private channel
  console.log("📡 Test 2: Testing private channel subscription...\n");

  const testChannel = supabase.channel("test-private-channel", {
    config: {
      broadcast: {
        self: false,
        ack: true,
      },
      private: true,
    },
  });

  const timeoutId = setTimeout(() => {
    console.error("\n❌ Subscription timed out after 10 seconds!");
    console.log("\nPossible issues:");
    console.log("1. Invalid private/service role key");
    console.log("2. Realtime not enabled in Supabase project");
    console.log("3. Network/firewall blocking WebSocket connections");
    console.log("4. Wrong Supabase project URL\n");
    process.exit(1);
  }, 10000);

  testChannel.subscribe((status, err) => {
    console.log(`Subscription status: ${status}`);

    if (err) {
      console.error("Error details:", err);
    }

    if (status === "SUBSCRIBED") {
      clearTimeout(timeoutId);
      console.log("\n✅ SUCCESS! Private channel subscription working!\n");

      // Test broadcast
      console.log("📤 Testing broadcast...");
      testChannel
        .send({
          type: "broadcast",
          event: "test",
          payload: { message: "Hello from test!" },
        })
        .then(() => {
          console.log("✅ Broadcast sent successfully!\n");
          console.log(
            "🎉 All tests passed! Your Supabase configuration is correct.\n"
          );
          process.exit(0);
        })
        .catch((error) => {
          console.error("❌ Broadcast failed:", error);
          process.exit(1);
        });
    }

    if (status === "TIMED_OUT") {
      clearTimeout(timeoutId);
      console.error("\n❌ Subscription timed out!");
      console.log("\nThis usually means:");
      console.log("1. The private key is invalid or lacks permissions");
      console.log(
        "2. Try using the service role key from Supabase dashboard\n"
      );
    }

    if (status === "CHANNEL_ERROR") {
      clearTimeout(timeoutId);
      console.error("\n❌ Channel error occurred!");
    }
  });

  // Test 3: Also try a public channel
  console.log("📡 Test 3: Testing public channel (for comparison)...\n");

  const publicChannel = supabase.channel("test-public-channel", {
    config: {
      broadcast: {
        self: false,
        ack: true,
      },
      private: false, // Public channel
    },
  });

  publicChannel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      console.log("ℹ️  Public channel subscription: SUCCESS");
      publicChannel.unsubscribe();
    }
  });
}

console.log("Starting Supabase connection test...");
testSupabase().catch(console.error);
