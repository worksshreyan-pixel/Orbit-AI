import { detectPlannerFastIntent } from '../../lib/agent/runtime';

describe('Planner Intent Detection', () => {
  it('correctly detects today_priorities intent for various phrasing', () => {
    const validRequests = [
      "What should I work on today?",
      "what should i do today",
      "what do I work on today",
      "what should I focus on today",
      "what are my priorities today?",
      "what should I focus on",
      "what are my top priorities",
      "show me today's priorities"
    ];

    validRequests.forEach(req => {
      expect(detectPlannerFastIntent(req)).toBe('today_priorities');
    });
  });

  it('returns null for non-planning requests', () => {
    const invalidRequests = [
      "What should I research about Next.js?",
      "Create a study plan for exams next week",
      "Review smart contract",
      "Write a whitepaper"
    ];

    invalidRequests.forEach(req => {
      expect(detectPlannerFastIntent(req)).toBeNull();
    });
  });
});
