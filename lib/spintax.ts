/**
 * Spintax Utility for Templates
 * Prevents Meta spam triggers through randomized variations of automated greetings and follow-ups.
 */

export const SPINTAX_GREETINGS = [
  "Hi, this is Dilsha from Arabic Talent.",
  "Hello! Dilsha here from Arabic Talent.",
  "Good afternoon, it's Dilsha from the Arabic Talent team.",
  "Hi there, Dilsha with Arabic Talent here.",
] as const;

/**
 * Randomly selects a greeting from the specified Spintax greetings pool.
 */
export function getRandomGreeting(): string {
  const index = Math.floor(Math.random() * SPINTAX_GREETINGS.length);
  return SPINTAX_GREETINGS[index];
}

/**
 * Parses generic Spintax formatted strings like:
 * "{Hi|Hello|Hey}, this is Dilsha from {Arabic Talent|the Arabic Talent team}."
 * Picks a random option for each pipe-separated group within curly braces.
 */
export function parseSpintax(template: string): string {
  if (!template) return "";
  let result = template;
  const spintaxRegex = /\{([^{}]+)\}/g;

  while (spintaxRegex.test(result)) {
    result = result.replace(spintaxRegex, (_, options) => {
      const choices = options.split("|");
      return choices[Math.floor(Math.random() * choices.length)].trim();
    });
  }

  return result;
}

/**
 * Generates a full message using a random greeting and an optional custom follow-up text.
 */
export function getSpintaxTemplate(customFollowUpText?: string): string {
  const greeting = getRandomGreeting();
  if (!customFollowUpText) return greeting;
  return `${greeting} ${customFollowUpText.trim()}`;
}
