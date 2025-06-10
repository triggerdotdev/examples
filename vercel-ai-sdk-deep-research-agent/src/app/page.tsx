import { DeepResearchAgent } from "@/components/DeepResearchAgent";
import { auth } from "@trigger.dev/sdk";

export default async function Home() {
  const triggerToken = await auth.createTriggerPublicToken("deep-research");

  return <DeepResearchAgent triggerToken={triggerToken} />;
}
