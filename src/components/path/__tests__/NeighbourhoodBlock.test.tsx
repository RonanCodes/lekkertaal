/**
 * Component tests for the learning-path redesign (issue #207).
 *
 * Covers the parts these components own:
 *   - <NeighbourhoodBlock/> derives per-tile state (done / current /
 *     available / locked) from the unit's lessonsCompleted / lessonsTotal.
 *   - The boss-fight bar is a live link when the unit is reachable, and an
 *     inert locked bar otherwise.
 *   - A locked unit renders no clickable tiles and links nowhere.
 *   - <PathStatusStrip/> renders the streak, an XP/level ring, coins
 *     (linking to the shop), and a hearts/freezes chip.
 */
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NeighbourhoodBlock } from "../NeighbourhoodBlock";
import { PathStatusStrip } from "../PathStatusStrip";
import type { PathUnit } from "../../../lib/server/path";

function unit(overrides: Partial<PathUnit> = {}): PathUnit {
  return {
    id: 1,
    slug: "groeten",
    titleNl: "Groeten",
    titleEn: "Greetings",
    order: 1,
    status: "in_progress",
    lessonsCompleted: 2,
    lessonsTotal: 5,
    ...overrides,
  };
}

describe("<NeighbourhoodBlock/>", () => {
  it("derives done / current / available tiles from progress", () => {
    render(<NeighbourhoodBlock unit={unit({ lessonsCompleted: 2, lessonsTotal: 5 })} />);
    expect(screen.getByLabelText("Lesson 1, completed")).toBeTruthy();
    expect(screen.getByLabelText("Lesson 2, completed")).toBeTruthy();
    expect(screen.getByLabelText("Lesson 3, continue")).toBeTruthy();
    expect(screen.getByLabelText("Lesson 4")).toBeTruthy();
    expect(screen.getByLabelText("Lesson 5")).toBeTruthy();
  });

  it("links reachable tiles to the unit detail and offers a live boss bar", () => {
    render(<NeighbourhoodBlock unit={unit({ status: "in_progress" })} />);
    const current = screen.getByLabelText("Lesson 3, continue");
    expect(current.getAttribute("href")).toBe("/app/unit/groeten");
    const boss = screen.getByLabelText("Boss fight");
    expect(boss.getAttribute("href")).toBe("/app/unit/groeten");
  });

  it("locks every tile and the boss bar for a locked unit", () => {
    render(
      <NeighbourhoodBlock
        unit={unit({ status: "locked", lessonsCompleted: 0, lessonsTotal: 3 })}
      />,
    );
    expect(screen.getByLabelText("Lesson 1, locked")).toBeTruthy();
    expect(screen.queryByLabelText("Boss fight")).toBeNull();
    expect(screen.getByLabelText("Boss fight (locked)")).toBeTruthy();
    // No tile is an anchor with an href.
    const list = screen.getByRole("list");
    expect(within(list).queryByRole("link")).toBeNull();
  });

  it("renders all tiles as done and an unlocked boss bar for a completed unit", () => {
    render(
      <NeighbourhoodBlock
        unit={unit({ status: "completed", lessonsCompleted: 3, lessonsTotal: 3 })}
      />,
    );
    expect(screen.getByLabelText("Lesson 3, completed")).toBeTruthy();
    expect(screen.getByLabelText("Boss fight").getAttribute("href")).toBe(
      "/app/unit/groeten",
    );
  });

  it("renders at least one tile even when lessonsTotal is zero", () => {
    render(<NeighbourhoodBlock unit={unit({ lessonsTotal: 0, lessonsCompleted: 0 })} />);
    expect(screen.getByRole("list").children.length).toBe(1);
  });
});

describe("<PathStatusStrip/>", () => {
  it("shows streak, level ring, coins-as-shop-link, and a hearts chip", () => {
    render(
      <PathStatusStrip streakDays={7} xpTotal={250} coinsBalance={120} freezes={0} />,
    );
    expect(screen.getByLabelText("7-day streak")).toBeTruthy();
    // 250 XP → level 3, 50 into the level.
    expect(screen.getByLabelText("Level 3, 50 of 100 XP to next level")).toBeTruthy();
    const coins = screen.getByLabelText("120 coins (tap to open shop)");
    expect(coins.getAttribute("href")).toBe("/app/shop");
    expect(screen.getByLabelText("Hearts full")).toBeTruthy();
  });

  it("shows a freeze chip when freezes are in reserve", () => {
    render(
      <PathStatusStrip streakDays={3} xpTotal={0} coinsBalance={0} freezes={2} />,
    );
    expect(screen.getByLabelText("2 streak freezes in reserve")).toBeTruthy();
  });
});
