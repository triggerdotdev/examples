import { Agent, run } from "@openai/agents";
import { logger, metadata, task } from "@trigger.dev/sdk";

// Example payload for testing:
// {
//   "prompt": "Write a short story about a robot learning to paint",
//   "genre": "sci-fi"
// }

export interface StreamingPromptPayload {
  prompt: string;
  genre?: "fantasy" | "sci-fi" | "mystery" | "romance" | "general";
}

export const streamingAgent = task({
  id: "streaming-agent",
  maxDuration: 120,
  run: async (payload: StreamingPromptPayload) => {
    logger.info("Starting streaming agent", {
      prompt: payload.prompt,
      genre: payload.genre,
    });

    // Create a creative writing agent with genre-specific instructions
    const genreInstructions = {
      fantasy:
        "You are a fantasy writer. Include magical elements and mythical creatures.",
      "sci-fi":
        "You are a science fiction writer. Focus on technology and future concepts.",
      mystery:
        "You are a mystery writer. Build suspense and include intriguing plot twists.",
      romance:
        "You are a romance writer. Focus on emotional connections and relationships.",
      general:
        "You are a creative writer. Write engaging stories with vivid descriptions.",
    };

    const agent = new Agent({
      name: `${payload.genre || "general"} Writer`,
      instructions: genreInstructions[payload.genre || "general"] +
        " Keep your writing engaging and detailed.",
    });

    // Update metadata with progress
    metadata.set("status", "initializing");
    metadata.set("prompt", payload.prompt);
    metadata.set("genre", payload.genre || "general");

    // ✅ Stream the response using OpenAI Agents SDK
    const result = await run(agent, payload.prompt, {
      stream: true,
    });

    metadata.set("status", "streaming");

    // ✅ Get text stream without Node.js compatibility
    const stream = result.toTextStream();

    let fullResponse = "";
    let chunkCount = 0;

    // Now chunks will be strings directly
    for await (const chunk of stream) {
      fullResponse += chunk;
      chunkCount++;
      console.log(chunk); // This will show actual text!

      // Update progress metadata
      metadata.set("chunksReceived", chunkCount);
      metadata.set("currentLength", fullResponse.length);
      metadata.set("progress", Math.round((fullResponse.length / 2000) * 100));
    }

    metadata.set("status", "completed");

    logger.info("Streaming agent completed", {
      totalChunks: chunkCount,
      responseLength: fullResponse.length,
      genre: payload.genre || "general",
    });

    return {
      prompt: payload.prompt,
      response: fullResponse,
      characterCount: fullResponse.length,
      agentName: agent.name,
      genre: payload.genre || "general",
      chunksReceived: chunkCount,
    };
  },
});
