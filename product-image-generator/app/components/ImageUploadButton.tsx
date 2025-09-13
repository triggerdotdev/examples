"use client";

import { UploadButton } from "@/lib/uploadthing";
import { useRouter } from "next/navigation";

export function ImageUploadDropzone() {
  const router = useRouter();

  return (
    <div className="h-full w-full flex items-center justify-center">
      <UploadButton
        endpoint="imageUploader"
        onClientUploadComplete={(res) => {
          // Do something with the response
          console.log("Files: ", res);

          const firstFile = res[0];

          if (firstFile?.serverData) {
            const searchParams = new URLSearchParams();
            searchParams.set(
              "publicAccessToken",
              firstFile.serverData.publicAccessToken
            );
            searchParams.set("fileUrl", firstFile.serverData.fileUrl);
            searchParams.set("runId", firstFile.serverData.runId);

            router.push(`?${searchParams.toString()}`);
          }
        }}
        onUploadError={(error: Error) => {
          // Do something with the error.
          console.error(`ERROR! ${error.message}`);
        }}
        className="bg-white border-2 border-dashed border-gray-300 hover:border-gray-400 rounded-lg px-8 py-12 text-center transition-colors cursor-pointer min-h-[200px] min-w-[300px] flex items-center justify-center"
      />
    </div>
  );
}
