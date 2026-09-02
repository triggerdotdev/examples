import { createContext } from "react";

export type QuizGateReporter = (quizId: string, blocked: boolean) => void;

export type QuizGateValue = {
  chatId: string | null;
  reportBlocking: QuizGateReporter;
};

export const QuizGateContext = createContext<QuizGateValue>({
  chatId: null,
  reportBlocking: () => {},
});
