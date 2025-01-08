/*
  Warnings:

  - You are about to drop the column `usage` on the `LLMResponse` table. All the data in the column will be lost.
  - Added the required column `provider` to the `LLMResponse` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tokensUsage` to the `LLMResponse` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LLMProvider" AS ENUM ('openai', 'anthropic', 'xai');

-- AlterTable
ALTER TABLE "LLMResponse" DROP COLUMN "usage",
ADD COLUMN     "provider" "LLMProvider" NOT NULL,
ADD COLUMN     "tokensUsage" INTEGER NOT NULL;
