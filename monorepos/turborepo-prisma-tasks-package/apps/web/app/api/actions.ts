"use server";

import { tasks } from "@repo/tasks/trigger";
import type { addNewUser } from "@repo/tasks";
//     👆 type only import

export async function myTask() {
  try {
    const handle = await tasks.trigger<typeof addNewUser>("add-new-user", {
      name: "Example user",
      email: "example@example.com",
    });

    return handle.id;
  } catch (error) {
    console.error(error);
    return { error: "something went wrong" };
  }
}
