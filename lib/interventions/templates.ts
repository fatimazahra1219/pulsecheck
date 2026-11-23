
export type InterventionInput = {
  question: string;
  wrongAnswer: string;
  correctAnswer: string;
  misconception?: string;
};

export type InterventionSuggestion = {
  id: string;
  title: string;
  prompt: string;
  notice?: string;
  requiresTeacherInput: boolean;
  teacherInputLabel?: string;
  teacherInputPlaceholder?: string;
};

export function buildInterventionSuggestions(
  input: InterventionInput,
): InterventionSuggestion[] {
  const wrongAnswer = input.wrongAnswer.trim();
  const correctAnswer = input.correctAnswer.trim();
  const misconception = input.misconception?.trim();

  // Don't generate suggestions from incomplete information.
  if (!wrongAnswer || !correctAnswer) {
    return [];
  }

  const hasMisconception = Boolean(misconception);

  // Be transparent when the teacher hasn't described the misconception.
  const notice = hasMisconception
    ? undefined
    : `Students chose "${wrongAnswer}". Add a note about the wrong idea to get a more targeted suggestion.`;

  return [
    {
      id: "explain",
      title: "Explain why it's wrong",
      prompt: hasMisconception
        ? `Why is this idea incorrect: "${misconception}"? Explain in one sentence.`
        : `Why is "${wrongAnswer}" not the right answer? Tell your partner in one sentence.`,
      notice,
      requiresTeacherInput: false,
    },
    {
      id: "compare",
      title: "Compare two",
      prompt: `What is the difference between "${wrongAnswer}" and "${correctAnswer}"?`,
      notice,
      requiresTeacherInput: false,
    },
    {
      id: "predict",
      title: "Guess the result",
      prompt: hasMisconception
        ? `Use an example that tests this idea: "${misconception}". Ask students to predict the result before revealing it.`
        : `Create an example that helps explain why "${wrongAnswer}" is incorrect. Ask students to predict the result.`,
      notice,
      requiresTeacherInput: true,
      teacherInputLabel: "Add a code or worked example",
      teacherInputPlaceholder:
        "Paste a short code example or describe a situation students can investigate...",
    },
    {
      id: "debug",
      title: "Find the error",
      prompt: hasMisconception
        ? `Create an example containing this mistake: "${misconception}". Ask students to find and correct it.`
        : `Create an example demonstrating why "${wrongAnswer}" is incorrect. Ask students to find and correct the mistake.`,
      notice,
      requiresTeacherInput: true,
      teacherInputLabel: "Add an incorrect example",
      teacherInputPlaceholder:
        "Paste incorrect code or a worked solution containing the mistake...",
    },
  ];
}
