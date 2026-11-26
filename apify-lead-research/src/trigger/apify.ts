import { ApifyClient } from "apify-client";

export const apify = new ApifyClient({
  token: process.env.APIFY_TOKEN,
  requestInterceptors: [
    (config) => {
      // Tells Apify which integration the API calls come from
      config.headers = { ...config.headers, "x-apify-integration-platform": "trigger.dev" };
      return config;
    },
  ],
});
