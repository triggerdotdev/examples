import { PageHeader } from "@/app/components/PageHeader";
import { Summary } from "@/app/components/Summary";

export default function Page({
  params: { eventId },
}: {
  params: { eventId: string };
}) {
  return (
    <main className="h-screen w-full bg-slate-900">
      <div className="flex flex-col gap-y-6 mx-auto items-center pt-40">
        <PageHeader />

        <div className="bg-slate-800 p-10 max-w-2xl items-center rounded-md border border-slate-700 flex flex-col gap-10 w-full">
          <Summary eventId={eventId} />
        </div>
      </div>
    </main>
  );
}
