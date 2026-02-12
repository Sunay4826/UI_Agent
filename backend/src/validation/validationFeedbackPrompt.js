export function validationFeedbackPrompt({ validationErrors }) {
  return `SYSTEM ROLE:
You convert validation errors into user friendly feedback.

VALIDATION ERRORS:
${JSON.stringify(validationErrors || [], null, 2)}

TASK:
Explain:
- What went wrong
- Which rule was violated
- How user can correct request

STYLE:
Helpful and constructive`;
}
