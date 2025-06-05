import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { processImage } from "./actions/process-image";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="grid grid-rows-[1fr_auto] min-h-screen items-center justify-center w-full ">
      <div className="flex flex-col gap-6 items-center">
        <h1 className="text-gray-900 text-3xl max-w-xl text-center font-bold">
          Generate an image using Trigger.dev and the Vercel AI SDK
        </h1>
        <p className="text-gray-900 text-lg max-w-xl text-center">
          Choose an image model and write a prompt to generate an image.
        </p>
        <form
          action={processImage}
          className="flex flex-col gap-4 w-full max-w-md"
        >
          <Select name="imageModel" required defaultValue="dall-e-3">
            <SelectTrigger>
              <SelectValue placeholder="Select an image model" />
            </SelectTrigger>
            <SelectContent>
              {/* OpenAI Models */}
              <SelectItem value="dall-e-3">OpenAI DALL-E 3</SelectItem>
              <SelectItem value="dall-e-2">OpenAI DALL-E 2</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            name="prompt"
            placeholder="What do you want to see?"
            required
          />
          <Button type="submit">Submit</Button>
        </form>
      </div>
    </main>
  );
}
