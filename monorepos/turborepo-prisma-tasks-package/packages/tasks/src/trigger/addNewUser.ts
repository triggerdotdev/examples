import { PrismaClient } from "@repo/db";
import { task } from "@trigger.dev/sdk/v3";

// Initialize Prisma client
const prisma = new PrismaClient();

export const addNewUser = task({
  id: "add-new-user",
  run: async (payload: { name: string; email: string; id: number }) => {
    const { name, email, id } = payload;

    // This will create a new user in the database
    const user = await prisma.user.create({
      data: {
        name: name,
        email: email,
        id: id,
      },
    });

    return {
      message: `New user added successfully: ${user.id}`,
    };
  },
});
