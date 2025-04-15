"use server";

import { wait } from "@trigger.dev/sdk";
import Link from "next/link";

export default async function ApprovalPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { variant?: string };
}) {
  // Await the params and searchParams objects
  const paramsData = await Promise.resolve(params);
  const searchParamsData = await Promise.resolve(searchParams);

  const tokenId = paramsData.slug;
  const variant = Number(searchParamsData?.variant || 1);

  console.log("Token ID is:", tokenId, "Variant:", variant);

  try {
    // Complete the token with the variant from the query param
    await wait.completeToken(tokenId, {
      memeVariant: variant,
    });

    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-green-600 mb-4">
          ✅ Meme Approved!
        </h1>
        <p>Your selection has been recorded.</p>
        <p className="mt-4 text-sm text-gray-500">
          You can close this window now.
        </p>
        <div className="mt-8">
          <Link href="/" className="text-blue-500 underline">
            Return to Home
          </Link>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Error completing token:", error);

    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">❌ Error</h1>
        <p>Could not complete the approval.</p>
        <p className="mt-4 text-sm text-gray-500">
          Details: {(error as Error).message}
        </p>
        <div className="mt-8">
          <Link href="/" className="text-blue-500 underline">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }
}
