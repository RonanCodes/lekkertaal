/**
 * Integration test for `persistRubric` (in-memory D1).
 *
 * `persistRubric` is the shared persistence path that both the non-streaming
 * `gradeRoleplaySession` server fn and the streaming `/api/roleplay/:sessionId
 * /grade-stream` route's `onFinish` callback funnel through. The behaviour
 * under test is the contract a streaming caller relies on:
 *
 *   - On first grading, all 5 rubric scores land on the roleplay_sessions
 *     row, error rows get inserted, XP is credited.
 *   - On a re-grade with a strictly higher score, the row is overwritten
 *     and the XP delta (not the full xpAwarded) is applied to the user.
 *   - On a re-grade with a lower or equal score, nothing changes.
 *
 * The streaming endpoint takes the same path on `onFinish`, so this test
 * also covers the "final persisted rubric matches the streamed value" leg
 * of the acceptance criteria.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb, seedUser, asD1 } from "./test-db";
import type { TestDb } from "./test-db";
import {
  roleplaySessions,
  roleplayErrors,
  scenarios,
  users,
} from "../../../db/schema";
import { persistRubric } from "../roleplay";
import type { RoleplayRubric } from "../roleplay";

function seedScenario(drz: TestDb, slug = "bakery") {
  return drz
    .insert(scenarios)
    .values({
      slug,
      titleNl: "Bij de bakker",
      titleEn: "At the bakery",
      difficulty: "A2",
      npcName: "Marieke",
      npcPersona: "friendly baker",
      openingNl: "Goedemorgen",
      estimatedMinutes: 5,
      xpReward: 100,
    })
    .returning({ id: scenarios.id });
}

async function seedSession(drz: TestDb, userId: number, scenarioId: number) {
  return drz
    .insert(roleplaySessions)
    .values({
      userId,
      scenarioId,
      transcript: [],
    })
    .returning({
      id: roleplaySessions.id,
      rubricGrammar: roleplaySessions.rubricGrammar,
      rubricVocab: roleplaySessions.rubricVocab,
      rubricTask: roleplaySessions.rubricTask,
      rubricFluency: roleplaySessions.rubricFluency,
      rubricPoliteness: roleplaySessions.rubricPoliteness,
      xpAwarded: roleplaySessions.xpAwarded,
    });
}

function rubric(
  overrides: Partial<RoleplayRubric> = {},
): RoleplayRubric {
  return {
    grammar: 4,
    vocabulary: 4,
    taskCompletion: 4,
    fluency: 3,
    politeness: 5,
    feedbackEn: "Nice work, mostly fluent.",
    errors: [
      {
        category: "grammar",
        incorrect: "ik wil een brood",
        correction: "ik wil graag een brood",
        explanationEn: "polite request needs 'graag'",
      },
    ],
    ...overrides,
  };
}

describe("persistRubric (integration: in-memory D1)", () => {
  let drz: TestDb;
  let userId: number;
  let scenarioId: number;

  beforeEach(async () => {
    drz = makeTestDb();
    userId = seedUser(drz);
    const s = await seedScenario(drz);
    scenarioId = s[0].id;
  });

  it("writes all 5 rubric scores, feedback, xpAwarded, and passed flag", async () => {
    const [sess] = await seedSession(drz, userId, scenarioId);

    const result = await persistRubric({
      drz: asD1(drz),
      sess: {
        id: sess.id,
        rubricGrammar: null,
        rubricVocab: null,
        rubricTask: null,
        rubricFluency: null,
        rubricPoliteness: null,
        xpAwarded: null,
      },
      scenario: { xpReward: 100 },
      meId: userId,
      meXpTotal: 0,
      rubric: rubric(),
      runPromote: false,
    });

    expect(result.replacedPrevious).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.xpAwarded).toBeGreaterThan(0);

    const stored = await drz
      .select()
      .from(roleplaySessions)
      .where(eq(roleplaySessions.id, sess.id))
      .limit(1);

    expect(stored[0].rubricGrammar).toBe(4);
    expect(stored[0].rubricVocab).toBe(4);
    expect(stored[0].rubricTask).toBe(4);
    expect(stored[0].rubricFluency).toBe(3);
    expect(stored[0].rubricPoliteness).toBe(5);
    expect(stored[0].feedbackMd).toContain("Nice work");
    expect(stored[0].xpAwarded).toBeGreaterThan(0);
    expect(stored[0].passed).toBe(true);
  });

  it("inserts error rows for each error in the rubric", async () => {
    const [sess] = await seedSession(drz, userId, scenarioId);

    await persistRubric({
      drz: asD1(drz),
      sess: {
        id: sess.id,
        rubricGrammar: null,
        rubricVocab: null,
        rubricTask: null,
        rubricFluency: null,
        rubricPoliteness: null,
        xpAwarded: null,
      },
      scenario: { xpReward: 100 },
      meId: userId,
      meXpTotal: 0,
      rubric: rubric({
        errors: [
          {
            category: "grammar",
            incorrect: "ik wil",
            correction: "ik wil graag",
          },
          {
            category: "vocab",
            incorrect: "brood",
            correction: "broodje",
            explanationEn: "small bread roll",
          },
        ],
      }),
      runPromote: false,
    });

    const errors = await drz
      .select()
      .from(roleplayErrors)
      .where(eq(roleplayErrors.sessionId, sess.id));
    expect(errors).toHaveLength(2);
    expect(errors[0].category).toBe("grammar");
    expect(errors[1].category).toBe("vocab");
    expect(errors[1].explanationEn).toBe("small bread roll");
  });

  it("credits XP to the user on a first-time grade", async () => {
    const [sess] = await seedSession(drz, userId, scenarioId);

    const result = await persistRubric({
      drz: asD1(drz),
      sess: {
        id: sess.id,
        rubricGrammar: null,
        rubricVocab: null,
        rubricTask: null,
        rubricFluency: null,
        rubricPoliteness: null,
        xpAwarded: null,
      },
      scenario: { xpReward: 100 },
      meId: userId,
      meXpTotal: 0,
      rubric: rubric(),
      runPromote: false,
    });

    const userRow = await drz
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    expect(userRow[0].xpTotal).toBe(result.xpAwarded);
  });

  it("does not overwrite when the new score is lower than the previous best", async () => {
    const [sess] = await seedSession(drz, userId, scenarioId);

    // First grade: a strong attempt.
    await persistRubric({
      drz: asD1(drz),
      sess: {
        id: sess.id,
        rubricGrammar: null,
        rubricVocab: null,
        rubricTask: null,
        rubricFluency: null,
        rubricPoliteness: null,
        xpAwarded: null,
      },
      scenario: { xpReward: 100 },
      meId: userId,
      meXpTotal: 0,
      rubric: rubric({
        grammar: 5,
        vocabulary: 5,
        taskCompletion: 5,
        fluency: 5,
        politeness: 5,
      }),
      runPromote: false,
    });

    const afterFirst = await drz
      .select()
      .from(roleplaySessions)
      .where(eq(roleplaySessions.id, sess.id))
      .limit(1);

    // Second grade: weaker attempt.
    const result2 = await persistRubric({
      drz: asD1(drz),
      sess: {
        id: sess.id,
        rubricGrammar: afterFirst[0].rubricGrammar,
        rubricVocab: afterFirst[0].rubricVocab,
        rubricTask: afterFirst[0].rubricTask,
        rubricFluency: afterFirst[0].rubricFluency,
        rubricPoliteness: afterFirst[0].rubricPoliteness,
        xpAwarded: afterFirst[0].xpAwarded,
      },
      scenario: { xpReward: 100 },
      meId: userId,
      meXpTotal: afterFirst[0].xpAwarded ?? 0,
      rubric: rubric({
        grammar: 2,
        vocabulary: 2,
        taskCompletion: 2,
        fluency: 2,
        politeness: 2,
      }),
      runPromote: false,
    });

    expect(result2.replacedPrevious).toBe(false);

    const afterSecond = await drz
      .select()
      .from(roleplaySessions)
      .where(eq(roleplaySessions.id, sess.id))
      .limit(1);

    // Scores unchanged from the first attempt.
    expect(afterSecond[0].rubricGrammar).toBe(5);
    expect(afterSecond[0].rubricVocab).toBe(5);
  });

  it("overwrites and credits XP delta when the new score is strictly higher", async () => {
    const [sess] = await seedSession(drz, userId, scenarioId);

    // First grade: mediocre.
    const first = await persistRubric({
      drz: asD1(drz),
      sess: {
        id: sess.id,
        rubricGrammar: null,
        rubricVocab: null,
        rubricTask: null,
        rubricFluency: null,
        rubricPoliteness: null,
        xpAwarded: null,
      },
      scenario: { xpReward: 100 },
      meId: userId,
      meXpTotal: 0,
      rubric: rubric({
        grammar: 3,
        vocabulary: 3,
        taskCompletion: 3,
        fluency: 3,
        politeness: 3,
      }),
      runPromote: false,
    });

    const after1 = await drz
      .select()
      .from(roleplaySessions)
      .where(eq(roleplaySessions.id, sess.id))
      .limit(1);
    const userAfter1 = await drz
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Second grade: better.
    const second = await persistRubric({
      drz: asD1(drz),
      sess: {
        id: sess.id,
        rubricGrammar: after1[0].rubricGrammar,
        rubricVocab: after1[0].rubricVocab,
        rubricTask: after1[0].rubricTask,
        rubricFluency: after1[0].rubricFluency,
        rubricPoliteness: after1[0].rubricPoliteness,
        xpAwarded: after1[0].xpAwarded,
      },
      scenario: { xpReward: 100 },
      meId: userId,
      meXpTotal: userAfter1[0].xpTotal ?? 0,
      rubric: rubric({
        grammar: 5,
        vocabulary: 5,
        taskCompletion: 5,
        fluency: 5,
        politeness: 5,
      }),
      runPromote: false,
    });

    expect(second.replacedPrevious).toBe(true);
    expect(second.xpAwarded).toBeGreaterThan(first.xpAwarded);

    const userAfter2 = await drz
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // User's XP went up by exactly the delta, not the full second.xpAwarded.
    expect(userAfter2[0].xpTotal).toBe(second.xpAwarded);
  });
});
