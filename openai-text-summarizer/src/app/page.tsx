import Form from "./components/Form";
import { PageHeader } from "./components/PageHeader";

export default function Home() {
  return (
    <main className="h-screen w-full bg-slate-900">
      <div className="flex flex-col gap-y-6 mx-auto items-center pt-40">
        <PageHeader />
        <Form />
      </div>
    </main>
  );
}
