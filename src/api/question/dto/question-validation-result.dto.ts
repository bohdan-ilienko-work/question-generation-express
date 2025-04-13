// Общий тип результата
export type ValidationResult = {
  questionId: string;
  isValid: boolean;
  suggestion: {
    question: string;
    correct: string | number[];
    wrong: string[];
  };
  totalTokensUsed: number;
  completionTokensUsed: number;
};
