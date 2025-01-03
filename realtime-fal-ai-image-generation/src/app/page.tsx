import { processImage } from "./actions/process-image";

export default function Home() {
  return (
    <main className="grid grid-rows-[1fr_auto] min-h-screen items-center justify-center w-full bg-gray-900">
      <div className="flex flex-col gap-12 items-center">
        <h1 className="text-gray-200 text-4xl max-w-xl text-center font-bold">
          Generate an image from another image using Fal.ai
        </h1>
        <form
          action={processImage}
          className="flex flex-col gap-4 w-full max-w-md"
        >
          <input
            type="url"
            name="imageUrl"
            placeholder="Paste image URL"
            className="px-4 py-2 rounded-md border border-gray-700 bg-gray-800 text-white"
            required
          />
          <textarea
            name="prompt"
            placeholder="Write a prompt"
            className="px-4 py-2 h-40 rounded-md border border-gray-700 bg-gray-800 text-white resize-none"
            required
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
          >
            Submit
          </button>
        </form>
      </div>
    </main>
  );
}
