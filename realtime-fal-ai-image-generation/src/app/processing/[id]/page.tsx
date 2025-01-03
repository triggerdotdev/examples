import { TriggerProvider } from "@/components/TriggerProvider";
import { ProcessingContent } from "./ProcessingContent";

export default async function ProcessingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ publicAccessToken: string }>;
}) {
  const $searchParams = await searchParams;
  const $params = await params;

  return (
    <TriggerProvider accessToken={$searchParams.publicAccessToken}>
      <ProcessingContent runId={$params.id} />
    </TriggerProvider>
  );
}
