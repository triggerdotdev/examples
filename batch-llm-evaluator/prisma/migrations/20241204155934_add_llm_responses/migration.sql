-- CreateTable
CREATE TABLE "LLMResponse" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "usage" JSONB NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "isWinner" BOOLEAN,

    CONSTRAINT "LLMResponse_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LLMResponse" ADD CONSTRAINT "LLMResponse_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
