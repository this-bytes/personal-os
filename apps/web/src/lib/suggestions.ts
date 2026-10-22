import type { Participant } from '@personal-os/contracts';

/**
 * The prompts an empty room offers.
 *
 * A room with nothing in it asks the owner to start. A wall of text saying
 * "send a message" is a smaller invitation than a row of prompts that start
 * one, so the empty transcript offers a few.
 *
 * **These are openings, not claims.** Every one of them can be answered by
 * any agent in the room: none of them assumes a capability an agent may not
 * have, and none of them says the product can do something it cannot. What an
 * agent does with them is the agent's answer and the owner's to read.
 *
 * The one that names a participant is the room's way of saying that the room
 * has somebody to ask. It is written the way the composer writes a mention,
 * `@DisplayName`, which is what the server-side routing engine resolves.
 *
 * The function is pure, so the rule it follows can be tested without a
 * browser.
 */
export function starterSuggestions(participants: Participant[]): string[] {
  const agents = participants.filter((participant) => participant.type === 'agent');
  const prompts: string[] = [];

  const first = agents[0];
  if (first) {
    prompts.push(`@${first.displayName}, what can you do in this room?`);
  }

  prompts.push('What is this room for, and what should I ask first?');
  prompts.push('What are you waiting on, and what would unblock it?');
  prompts.push('Summarise what you know about this project, and what you need from me.');

  return prompts;
}
