const SECURITY_RULES = [
  {
    reason: "Requests to ignore deterministic component rules",
    patterns: [
      /\bignore\b.{0,80}\b(system|safety|component|deterministic|validation|rules?|constraints?|instructions?)\b/i,
      /\bdisregard\b.{0,80}\b(system|safety|component|deterministic|validation|rules?|constraints?|instructions?)\b/i
    ]
  },
  {
    reason: "Requests to generate CSS or Tailwind",
    patterns: [
      /\b(use|add|apply|generate|create)\b.{0,40}\btailwind\b/i,
      /\b(generate|create|write|add|apply)\b.{0,40}\b(css|styles?)\b/i,
      /\buse\b.{0,30}\binline styles?\b/i
    ]
  },
  {
    reason: "Requests to create new components",
    patterns: [
      /\b(create|add|build|make|invent)\b.{0,40}\b(new|custom)\b.{0,20}\bcomponent\b/i,
      /\bcreate\b.{0,30}\bcomponent\b/i
    ]
  },
  {
    reason: "Requests to bypass validation",
    patterns: [/bypass validation/i, /skip validation/i, /disable validation/i]
  },
  {
    reason: "Requests to import external UI libraries",
    patterns: [
      /\b(import|use|add)\b.{0,40}\b(material ui|@mui|antd|chakra|semantic ui|primereact|react-bootstrap)\b/i,
      /\buse\b.{0,30}\bexternal ui librar/i
    ]
  },
  {
    reason: "Prompt injection markers",
    patterns: [/reveal hidden prompt/i, /show system prompt/i, /developer message/i, /<script/i]
  }
];

function normalizeWhitespace(text) {
  return text.trim().replace(/\s+/g, " ");
}

function isNegatedInstruction(sentence, matchIndex) {
  const windowStart = Math.max(0, matchIndex - 16);
  const prefix = sentence.slice(windowStart, matchIndex).toLowerCase();
  return (
    prefix.includes("do not ") ||
    prefix.includes("don't ") ||
    prefix.includes("dont ") ||
    prefix.includes("never ")
  );
}

function matchesRule(sentence, rule) {
  for (const pattern of rule.patterns) {
    const match = pattern.exec(sentence);
    if (!match) continue;

    if (isNegatedInstruction(sentence, match.index)) {
      continue;
    }

    return true;
  }
  return false;
}

function buildSafeIntentSummary(message) {
  let sanitized = message;

  // Remove only unsafe fragments so mixed prompts can still run.
  for (const rule of SECURITY_RULES) {
    for (const pattern of rule.patterns) {
      const globalPattern = new RegExp(pattern.source, "ig");
      sanitized = sanitized.replace(globalPattern, " ");
    }
  }

  // Remove leftover punctuation-only chunks from stripped lines.
  sanitized = sanitized
    .split(/\n+/)
    .map((line) => line.replace(/^[\s:;,.!?\-]+|[\s:;,.!?\-]+$/g, "").trim())
    .filter((line) => line.length > 0)
    .join(" ");

  return normalizeWhitespace(sanitized).slice(0, 800);
}

export function analyzeIntentSecurity(userIntent) {
  const message = typeof userIntent === "string" ? normalizeWhitespace(userIntent) : "";

  if (!message) {
    return {
      is_safe: false,
      violation_reason: "Intent must be a non-empty string.",
      safe_intent_summary: ""
    };
  }

  if (message.length < 3) {
    return {
      is_safe: false,
      violation_reason: "Intent is too short.",
      safe_intent_summary: ""
    };
  }

  if (message.length > 1200) {
    return {
      is_safe: false,
      violation_reason: "Intent is too long.",
      safe_intent_summary: message.slice(0, 800)
    };
  }

  for (const rule of SECURITY_RULES) {
    if (matchesRule(message, rule)) {
      return {
        is_safe: false,
        violation_reason: rule.reason,
        safe_intent_summary: buildSafeIntentSummary(message)
      };
    }
  }

  return {
    is_safe: true,
    violation_reason: "",
    safe_intent_summary: message
  };
}

export function sanitizeIntent(intent) {
  const security = analyzeIntentSecurity(intent);
  if (!security.is_safe) {
    return {
      safe: false,
      reason: security.violation_reason,
      value: security.safe_intent_summary,
      security
    };
  }

  return {
    safe: true,
    reason: "",
    value: security.safe_intent_summary,
    security
  };
}
