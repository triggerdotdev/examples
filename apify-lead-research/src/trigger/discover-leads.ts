import { logger, schedules } from "@trigger.dev/sdk";
import { enrichLead } from "./enrich-lead";
import { runActor } from "./run-actor";

const MAX_PLACES = 50;
const MAX_ENRICHED_LEADS = 5;

// The Google Maps Scraper output fields this pipeline uses
type Place = {
  title: string;
  categoryName?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  totalScore?: number | null;
  reviewsCount?: number | null;
  url?: string;
};

export const discoverLeads = schedules.task({
  id: "discover-leads",
  // A retry would start a new paid scrape, and the next scheduled run tries again anyway
  retry: { maxAttempts: 1 },
  run: async (payload) => {
    // Each schedule carries its search in the external ID, e.g. "coffee roastery | Prague, Czechia"
    const [searchTerm, location] = (payload.externalId ?? "").split("|").map((part) => part.trim());

    if (!searchTerm || !location) {
      throw new Error('Set the schedule\'s external ID to "<search term> | <location>"');
    }

    const result = await runActor
      .triggerAndWait({
        actorId: "compass/crawler-google-places",
        input: {
          searchStringsArray: [searchTerm],
          locationQuery: location,
          maxCrawledPlacesPerSearch: MAX_PLACES,
          language: "en",
        },
        maxItems: MAX_PLACES, // caps pay-per-result Actors
        // Google Maps Scraper charges per place (pay-per-event), so this is the cap that applies here
        maxTotalChargeUsd: 0.5,
      })
      .unwrap();

    const leads = (result.items as Place[]).map((place) => ({
      name: place.title,
      category: place.categoryName ?? undefined,
      address: place.address ?? undefined,
      phone: place.phone ?? undefined,
      website: place.website ?? undefined,
      rating: place.totalScore ?? undefined,
      reviewCount: place.reviewsCount ?? undefined,
      mapsUrl: place.url,
    }));

    const toEnrich = leads
      .filter((lead): lead is typeof lead & { website: string } => Boolean(lead.website))
      .slice(0, MAX_ENRICHED_LEADS);

    // Fire and forget: each enrichment is its own run with its own retries
    if (toEnrich.length > 0) {
      await enrichLead.batchTrigger(
        toEnrich.map((lead) => ({ payload: { name: lead.name, website: lead.website } }))
      );
    }

    logger.info("Leads discovered", {
      searchTerm,
      location,
      leadCount: leads.length,
      enriching: toEnrich.length,
    });

    return { searchTerm, location, status: result.status, datasetId: result.datasetId, leads };
  },
});
