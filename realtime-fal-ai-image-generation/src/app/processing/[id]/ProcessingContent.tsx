"use client";

import type { realtimeImageGeneration } from "@/trigger/realtime-generate-image";
import { useRealtimeRun } from "@trigger.dev/react-hooks";
import Image from "next/image";
import Link from "next/link";

export function ProcessingContent({ runId }: { runId: string }) {
  const { run, error } = useRealtimeRun<typeof realtimeImageGeneration>(runId);

  if (!run && !error) {
    return (
      <div className="min-h-screen bg-gray-900 p-8 grid place-items-center">
        <div className="text-gray-200">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 p-8 grid place-items-center">
        <div className="text-rose-500">Error: {error.message}</div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-gray-900 p-8 grid place-items-center">
        <div className="text-gray-200">No run data available</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8 grid place-items-center">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-gray-200 mb-16">
          {run.status === "COMPLETED"
            ? "Image generation complete!"
            : "Processing image..."}
        </h1>

        {run.status !== "COMPLETED" && (
          <div className="text-center mb-8">
            {run.status === "EXECUTING" ? (
              <span className="text-gray-400 flex items-center gap-2 justify-center">
                <LoadingSpinner />
                Generating image...
              </span>
            ) : run.status === "FAILED" ? (
              <span className="text-rose-500">Failed to create image</span>
            ) : (
              "Processing image..."
            )}
          </div>
        )}

        <div className="grid grid-cols-2 place-items-center gap-8">
          <div>
            <h2 className="text-lg text-gray-400 text-center mb-4">
              Original image
            </h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={run.payload.imageUrl}
              alt="Original"
              width={400}
              height={400}
              className="rounded-lg"
            />
          </div>

          {run.output?.imageUrl ? (
            <div>
              <h2 className="text-lg text-gray-400 text-center mb-4">
                Generated image
              </h2>
              <Image
                src={run.output.imageUrl}
                alt="Generated image"
                width={400}
                height={400}
                className="rounded-lg"
              />
            </div>
          ) : (
            <span className="text-gray-400 flex items-center gap-2 justify-center">
              <LoadingSpinner />
              Loading...
            </span>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-white bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-md"
          >
            Generate another image
          </Link>
        </div>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="animate-spin"
    >
      <circle cx="8" cy="8" r="6" stroke="#3B82F6" strokeWidth="2" />
      <path
        d="M14 8C14 11.3137 11.3137 14 8 14"
        stroke="#1E3A8A"
        strokeWidth="2"
      />
    </svg>
  );
}
