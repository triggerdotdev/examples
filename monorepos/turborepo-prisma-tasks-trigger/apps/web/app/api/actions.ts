"use server";
import { tasks } from "@trigger.dev/sdk/v3";
import { addNewUser } from "../../src/trigger/addNewUser";
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
