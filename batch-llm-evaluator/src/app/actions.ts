"use server";

import { db } from "@/lib/db";
import { auth, tasks } from "@trigger.dev/sdk/v3";
import { evaluateModels } from "@/trigger/batch";

export async function createAndRunEval(prompt: string) {
  const evaluation = await db.evaluation.create({
    data: {
      prompt,
    },
  });

  console.log(`Created evaluation with ID: ${evaluation.id}`);

  const run = await tasks.trigger<typeof evaluateModels>("eval-models", {
    id: evaluation.id,
  });

  const accessToken = await auth.createPublicToken({
    scopes: {
      read: {
        tags: [`eval:${evaluation.id}`],
      },
    },
  });

  return { evaluation, accessToken };
}
