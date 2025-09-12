import { auth } from "@trigger.dev/sdk";
import ProductImageGenerator from "./ProductImageGenerator";

export default async function Page() {
  const triggerToken = await auth.createTriggerPublicToken([
    "upload-image-and-analyze",
  ]);
  return <ProductImageGenerator triggerToken={triggerToken} />;
}
