import { expect, test } from "vitest";
import type { Coord } from "@/lib/types";

test("the runner works and the alias resolves", () => {
  const redFort: Coord = [77.241, 28.6562];
  expect(redFort).toHaveLength(2);
});
