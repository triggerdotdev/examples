"use client";

import { UploadButton } from "@/lib/uploadthing";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";

export function ImageUploadDropzone() {
  const router = useRouter();

  return (
    <div className="aspect-[3/4] border transition-colors relative overflow-hidden group bg-card p-0 rounded-lg">
      <UploadButton
        endpoint="imageUploader"
        onClientUploadComplete={(res) => {
          const firstFile = res.at(0);

          if (firstFile?.serverData) {
            const searchParams = new URLSearchParams();
            searchParams.set(
              "publicAccessToken",
              firstFile.serverData.publicAccessToken
            );
            searchParams.set("fileUrl", firstFile.serverData.fileUrl);
            searchParams.set("runId", firstFile.serverData.runId);
            searchParams.set("triggerToken", firstFile.serverData.triggerToken);

            router.push(`?${searchParams.toString()}`);
          }
        }}
        onUploadError={(error: Error) => {
          // Do something with the error.
          console.error(`ERROR! ${error.message}`);
        }}
        className="h-full w-full flex flex-col items-center justify-center p-6 ut-button:bg-blue-500/60 ut-button:gap-1 ut-button:flex ut-button:items-center ut-button:justify-center ut-button:space-y-4 text-center bg-card hover:bg-card/80 transition-colors cursor-pointer"
        content={{
          button: (
            <>
              <Upload className="h-4 w-4 text-white m-0" />
              <span className="block text-sm font-medium text-white mb-0">
                Upload Image
              </span>
            </>
          ),
          allowedContent: "Images up to 4MB",
        }}
      />
    </div>
  );
}
