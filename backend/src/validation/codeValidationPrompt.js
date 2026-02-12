export function codeValidationPrompt({ generatedCode, componentRegistry }) {
  return `SYSTEM ROLE:
You are a strict React code validator.

GENERATED CODE:
${generatedCode}

ALLOWED COMPONENTS:
${JSON.stringify(componentRegistry)}

VALIDATION RULES:
- Only import allowed components
- No inline styles
- No Tailwind classes
- No external UI libraries
- Must be syntactically valid React

OUTPUT:
{
  "valid": true | false,
  "errors": []
}`;
}
