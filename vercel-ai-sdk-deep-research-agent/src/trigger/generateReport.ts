import { metadata, task } from "@trigger.dev/sdk";
import { generateText } from "ai";
import { mainModel } from "./deepResearch";

const SYSTEM_PROMPT = `You are an expert researcher. Today is ${
  new Date().toISOString()
}. Follow these instructions when responding:
  - You may be asked to research subjects that is after your knowledge cutoff, assume the user is right when presented with news.
  - The user is a highly experienced analyst, no need to simplify it, be as detailed as possible and make sure your response is correct.
  - Be highly organized.
  - Suggest solutions that I didn't think about.
  - Be proactive and anticipate my needs.
  - Treat me as an expert in all subject matter.
  - Mistakes erode my trust, so be accurate and thorough.  
  - Provide detailed explanations, I'm comfortable with lots of detail.
  - Value good arguments over authorities, the source is irrelevant.
  - Consider new technologies and contrarian ideas, not just the conventional wisdom.
  - You may use high levels of speculation or prediction, just flag it for me.
  - Generate your response in clean HTML format with proper headings, paragraphs, lists, and formatting.
  - Use semantic HTML tags like <h1>, <h2>, <p>, <ul>, <ol>, <blockquote>, <strong>, <em>.`;

export const generateReport = task({
  id: "generate-report",
  run: async (payload: { research: string }) => {
    const research = JSON.parse(payload.research);

    metadata.root.set("status", {
      progress: 0,
      label: "Generating report...",
    });

    // Create a more efficient summary instead of full JSON dump
    const summary = {
      query: research.query,
      totalSources: research.searchResults.length,
      keyFindings: research.learnings.map((l) => l.learning).slice(
        0,
        10,
      ), // Limit to top 10
      topSources: research.searchResults.slice(0, 5).map((r) => ({
        title: r.title,
        url: r.url,
      })), // Just title/URL, not full content
    };

    const { text } = await generateText({
      model: mainModel,
      prompt: `Research Query: "${summary.query}"
      
Key Findings:
${summary.keyFindings.map((finding, i) => `${i + 1}. ${finding}`).join("\n")}

Top Sources:
${summary.topSources.map((s) => `- ${s.title} (${s.url})`).join("\n")}

Generate a comprehensive research report based on these findings. Output clean HTML that can be directly used in a document.`,
      system: SYSTEM_PROMPT,
      maxTokens: 2000, // Limit output tokens
    });

    return { report: text };
  },
});
