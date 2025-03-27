export function isValidCategory(category: string | null): boolean {
  const validCategories = [
    "countries",
    "animals",
    "languages",
    "movies",
    "sports",
  ];
  return category !== null && validCategories.includes(category.toLowerCase());
}

export function isValidDifficulty(difficulty: string | null): boolean {
  const availableDifficulties = ["easy", "medium", "hard"];
  return (
    difficulty !== null &&
    availableDifficulties.includes(difficulty.toLowerCase())
  );
}

// Extract entity from NLU response
export function extractEntity(
  entities: any[] | undefined,
  entityType: string,
): string | null {
  if (!entities) return null;

  const entity = entities.find((e) => e.category === entityType);
  if (!entity) return null;

  // Special handling for difficulty synonyms
  if (entityType === "difficulty" && entity.extraInformation) {
    const extraInfo = Array.isArray(entity.extraInformation)
      ? entity.extraInformation[0]
      : entity.extraInformation;

    if (extraInfo?.key) {
      return extraInfo.key;
    }
  }

  return entity.text || null;
}
