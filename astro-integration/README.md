# An Astro project with native Trigger.dev integration

This project is a simple example of how to integrate Trigger.dev into an Astro project.

This example project provides:
* An `api/trigger.js` file that creates the Trigger.dev webhook endpoint for integration
* `astro.config.mjs` in a server-side rendering configuration (required, for the API endpoints)
* An `api/event.js` file that serves as the entry point to call in order to trigger a new event in Trigger.dev
* A `trigger.js` that instantiates the Trigger.dev client and registers a job.

This example project doesn't provide:
* A UI to trigger the event (you can use `curl` to trigger the event via `/api/event`)

## 🚀 Astro project structure

Inside of this Astro project, you'll find the following files relevant to the Trigger.dev setup:

```
/
├── src/
│   └── pages/
│       └── api/
│            └── trigger.js
│            └── event.js
├── .env.example
└── trigger.js
```

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm run dev`             | Starts local dev server at `localhost:3000`      |
| `npm run trigger:dev`     | Only for local dev: creates a tunnel from trigger.dev to your localhost so the hosted Trigger.dev platform can communicate with your local Astro project          |

## 👀 Want to learn more?

Feel free to check [Trigger.dev documentation](https://trigger.dev/docs/documentation/introduction) or jump into Trigger.dev's [Discord server](https://discord.gg/kA47vcd8P6).

## License

MIT

## Author

(c) Liran Tal <liran@lirantal.com>