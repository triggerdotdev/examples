"use server";

import { tasks } from "@repo/tasks";
import type { addNewUser } from "@repo/tasks/trigger";

export async function myTask(): Promise<
  { handle: unknown } | { error: string }
> {
  try {
    const handle = await tasks.trigger<typeof addNewUser>("add-new-user", {
      name: "Example user",
      email: "example@example.com",
      // Generate a random id
      id: Math.floor(Math.random() * 1000) + 1,
    });

    return { handle };
  } catch (error) {
    console.error(error);
    return { error: "something went wrong" };
  }
}
