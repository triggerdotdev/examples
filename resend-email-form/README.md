# Send a React email from a form using Trigger.dev and Resend

In this project the user can submit a form which triggers a background job which sends an email using Resend. The email is built using React and the data from the form.

## This project demonstrates:

- How to use Trigger.dev in a Next.js project using the [App Router](https://nextjs.org/docs/app).
- How to build a form which can trigger a background job when submitted in `SendEmailForm.tsx`.
- How to use the Trigger.dev [Resend integration](https://trigger.dev/docs/integrations/apis/resend).
- Creating a Job which sends an email built using React, in `sendReactEmail.tsx`.

## **Step 1:** Create accounts

Create accounts for [Trigger.dev](https://trigger.dev) and [Resend](https://resend.com) before moving to the next step.

## **Step 2:** Set up your Project

Create or select an Organization and Project in Trigger.dev. Then copy your API key from the "Environments & API Keys" page in your Project.

## **Step 3:** Run the CLI `init` command

In a new terminal window, run the Trigger.dev CLI and enter your API key to your Trigger.dev environment variables:

```bash
npx @trigger.dev/cli@latest init
```

## **Step 4:** Get your Resend API key

[Sign up](https://resend.com/signup) to Resend and get your API key.

Manually add your Resend API key to your .env.local file:

```bash
RESEND_API_KEY=your-api-key
```

## **Step 5:** Install the dependencies

```bash
npm install
```

## **Step 6:** Run the Next.js project

Run the Next.js project:

```bash
npm run dev
```

## **Step 7:** Run the CLI `dev` command

With the Next.js project running, open another terminal window and run the Trigger.dev CLI `dev` command:

```bash
npx @trigger.dev/cli@latest dev
```

## **Step 8:** Test the Jobs

You can test the Job by going to `http://localhost:3000/` and filling in the form fields.

You can also send a test email using the Trigger.dev [test feature](https://trigger.dev/docs/documentation/guides/testing-jobs). That can be found on the Job page in the [Trigger.dev app](https://cloud.trigger.dev).

---

You can learn more about [testing](https://trigger.dev/docs/documentation/guides/testing-jobs), [viewing runs](https://trigger.dev/docs/documentation/guides/viewing-runs), and much more in our [docs](https://trigger.dev/docs).
