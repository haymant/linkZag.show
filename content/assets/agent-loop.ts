import type { Evidence, Goal, Patch } from './types'

/**
 * A coding agent is only as good as its verification loop.
 * Generate cheaply; accept only what the evidence supports.
 */
export async function shipVerified(goal: Goal, agent: Agent): Promise<Patch> {
  const plan = await agent.plan(goal)

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const patch = await agent.act(plan)
    const evidence: Evidence = await agent.verify(patch)

    if (evidence.passed) {
      return agent.ship(patch, evidence)
    }

    plan.revise(evidence.failures)
  }

  throw new Error('No verified patch within budget')
}
