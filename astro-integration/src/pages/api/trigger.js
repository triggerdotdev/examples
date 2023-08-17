import { createAstroRoute } from "triggerdev-astro-integration";
import { client } from "../../../trigger.js";

export const post = createAstroRoute(client);
