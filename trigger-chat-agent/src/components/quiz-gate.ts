import { createContext } from "react";

export type QuizGateReporter = (quizId: string, blocked: boolean) => void;

export const QuizGateContext = createContext<QuizGateReporter>(() => {});
