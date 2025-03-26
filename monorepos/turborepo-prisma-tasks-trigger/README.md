# Turborepo monorepo demo with a Prisma package and Trigger.dev installed in a Next.js app

This example demonstrates how to use Trigger.dev and Prisma in a monorepo created with Turborepo. Prisma has been added as a package, and Trigger.dev has been installed in a Next.js app. The task is triggered by a button click in the app via a server action.

## Overview & features

- This monorepo has been created using the [Turborepo CLI](https://turbo.build/repo), following the official [Prisma and Turborepo docs](https://www.prisma.io/docs/guides/turborepo), and then adapted for use with Trigger.dev.
- [pnpm](https://pnpm.io/) has been used as the package manager.
- A database package (`@repo/db`) using [Prisma ORM](https://www.prisma.io/docs/orm/) is used to interact with the database. You can use any popular Postgres database supported by Prisma, e.g. [Supabase](https://supabase.com/), [Neon](https://neon.tech/), etc.
- A [Next.js](https://nextjs.org/) example app (`apps/web`) to show how to trigger the task via a server action.
- Trigger.dev initialized and an `addNewUser` task created in the `web` app.

## Relevant files and code

### Database package (`@repo/db`)

- Located in [`/packages/database/`](./packages/database/) and exported as `@repo/db`
- Schema defined in [`/packages/database/prisma/schema.prisma`](./packages/database/prisma/schema.prisma)
- Provides database access to other packages and apps

### Next.js app (`apps/web`)

- Contains Trigger.dev configuration in [`trigger.config.ts`](./apps/web/trigger.config.ts)
- Trigger.dev tasks are defined in [`src/trigger/`](./apps/web/src/trigger/) (e.g., [`addNewUser.ts`](./apps/web/src/trigger/addNewUser.ts))
- Demonstrates triggering tasks via server actions in [`app/api/actions.ts`](./apps/web/app/api/actions.ts)

## Setup and development

1. After cloning the repository, install the dependencies in the root of the monorepo:

   ```bash
   pnpm install
   ```

2. Create `.env` files in [`apps/web`](./apps/web), [`packages/database`](./packages/database) with the correct environment variables. Copy the structure from the `.env.example` files and use the correct values for your database and Trigger.dev project. If you don't have a Trigger.dev project yet, you can create one at [here](https://cloud.trigger.dev/).
3. Set up the database and run migrations:

   ```bash
   pnpm turbo db:generate   # Generate Prisma client
   pnpm turbo db:migrate    # Run migrations
   ```

4. Update the Trigger.dev project ref in the [`trigger.config.ts`](./apps/web/trigger.config.ts) file.

5. Start the development server for the Next.js app:

   ```bash
   pnpm turbo run dev --filter=web
   ```

   and in a separate terminal window, run the Trigger.dev `dev` command, in the `packages/tasks` folder:

   ```bash
   cd packages/tasks
   pnpm dlx trigger.dev@latest dev
   ```

   > Note: when running the dev command, you will get some warnings in the console: "▲ WARNING The condition "default" here will never be used as it comes after both "import" and "require" package.json". These warnings can be safely ignored, and won't affect the functionality of the app. They will be fixed in an upcoming release.

6. Access the application at http://localhost:3000, and test the functionality by clicking the "Add new user" button on the web app to trigger the task
7. Go to the Trigger.dev dashboard to see the task being executed

## Learn more

- [Trigger.dev docs](https://trigger.dev/docs) - learn about Trigger.dev and its features.
- [Turborepo docs](https://turbo.build/repo) - learn about Turborepo and its features.
- [Prisma docs](https://www.prisma.io/docs) - learn about Prisma and its features.
