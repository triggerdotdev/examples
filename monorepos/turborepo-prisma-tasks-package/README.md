# Turborepo monorepo demo with Trigger.dev and Prisma packages

This simple example demonstrates how to use Trigger.dev and Prisma as packages inside a monorepo created with Turborepo. The Trigger.dev task is triggered by a button click in a Next.js app which triggers the task via a server action.

## Overview & features

- This monorepo has been created using the [Turborepo CLI](https://turbo.build/repo), following the official [Prisma and Turborepo docs](https://www.prisma.io/docs/guides/turborepo), and then adapted for use with Trigger.dev.
- [pnpm](https://pnpm.io/) has been used as the package manager.
- A tasks package (`@repo/tasks`) using [Trigger.dev](https://trigger.dev) is used to create and execute tasks from an app inside the monorepo.
- A database package (`@repo/db`) using [Prisma ORM](https://www.prisma.io/docs/orm/) is used to interact with the database. You can use any popular Postgres database supported by Prisma, e.g. [Supabase](https://supabase.com/), [Neon](https://neon.tech/), etc.
- A [Next.js](https://nextjs.org/) example app (`apps/web`) to show how to trigger the task via a server action.

## Relevant files and code

### Database package

- Prisma is added as a package in [`/packages/database`](./packages/database/) and exported as `@repo/db` in the [`package.json`](/packages/database/package.json) file.
- The schema is defined in the [`prisma/schema.prisma`](/packages/database/prisma/schema.prisma) file.

### Tasks package

> Note: to run `pnpm dlx trigger.dev@latest init` in a blank packages folder, you have to add a `package.json` file first, otherwise it will attempt to add Trigger.dev files in the root of your monorepo.

- Trigger.dev is added as a package in [`/packages/tasks`](/packages/tasks/) and exported as `@repo/tasks` in the [`package.json`](/packages/tasks/package.json) file.
- The [`addNewUser.ts`](/packages/tasks/src/trigger/addNewUser.ts) task adds a new user to the database.
- The [`packages/tasks/src/index.ts`](/packages/tasks/src/index.ts) file exports values and types from the Trigger.dev SDK, and is exported from the package via the [`package.json`](/packages/tasks/package.json) file.
- The [`packages/tasks/src/trigger/index.ts`](/packages/tasks/src/trigger/index.ts) file exports the task from the package. Every task must be exported from the package like this.
- The [`trigger.config.ts`](/packages/tasks/trigger.config.ts) file configures the Trigger.dev project settings. This is where the Trigger.dev [Prisma build extension](https://trigger.dev/docs/config/extensions/prismaExtension) is added, which is required to use Prisma in the Trigger.dev task.

### A Next.js app `apps/web`

- The app is a simple Next.js app that uses the `@repo/db` package to interact with the database and the `@repo/tasks` package to trigger the task. These are both added as dependencies in the [`package.json`](/apps/web/package.json) file.
- The task is triggered from a button click in the app in [`page.tsx`](/apps/web/app/page.tsx), which uses a server action in [`/app/api/actions.ts`](/apps/web/app/api/actions.ts) to trigger the task with an example payload.

## How to use

1. After cloning the repository, install the dependencies in the root of the monorepo:

   ```bash
   pnpm install
   ```

2. Create `.env` files in [`apps/web`](./apps/web), [`packages/database`](./packages/database) and [`packages/tasks`](./packages/tasks) with the correct environment variables. Copy the structure from the `.env.example` files and use the correct values for your database and Trigger.dev project. If you don't have a Trigger.dev project yet, you can create one at [here](https://cloud.trigger.dev/).
3. Set up the database and run migrations:

   ```bash
   pnpm turbo db:generate   # Generate Prisma client
   pnpm turbo db:migrate    # Run migrations
   ```

4. Update the Trigger.dev project ref in the [`trigger.config.ts`](./packages/tasks/trigger.config.ts) file.

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
