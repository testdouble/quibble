// Counts how many times Node has evaluated this module in this process
globalThis.__quibbleImportGraphEvaluations = (globalThis.__quibbleImportGraphEvaluations ?? 0) + 1
export const evaluation = globalThis.__quibbleImportGraphEvaluations
