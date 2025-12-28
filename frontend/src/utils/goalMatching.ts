/**
 * Goal-Task Matching Utility
 * Matches tasks to monthly goals using semantic similarity
 */

export interface Goal {
  id: string;
  title: string;
  description?: string | null;
}

/**
 * Calculate similarity between a goal and a task title
 * Returns a score between 0 and 1
 */
export function calculateGoalTaskSimilarity(goalTitle: string, taskTitle: string): number {
  const goalLower = goalTitle.toLowerCase();
  const taskLower = taskTitle.toLowerCase();
  
  // Extract keywords (remove common words)
  const stopWords = new Set(['a', 'an', 'the', 'to', 'for', 'of', 'in', 'on', 'at', 'by', 'with', 'and', 'or', 'but']);
  const goalWords = new Set(
    goalLower.match(/\b\w+\b/g)?.filter(w => !stopWords.has(w) && w.length > 2) || []
  );
  const taskWords = new Set(
    taskLower.match(/\b\w+\b/g)?.filter(w => !stopWords.has(w) && w.length > 2) || []
  );
  
  if (goalWords.size === 0) return 0.0;
  
  // Direct word overlap
  const overlap = new Set([...goalWords].filter(w => taskWords.has(w)));
  const wordSimilarity = overlap.size / goalWords.size;
  
  // Substring matches
  let substringMatch = 0.0;
  for (const goalWord of goalWords) {
    if (goalWord.length > 3 && taskLower.includes(goalWord)) {
      substringMatch += 0.4;
    }
  }
  
  // Category-based matching
  const categoryKeywords: Record<string, string[]> = {
    'read': ['read', 'book', 'article', 'study', 'chapter', 'page', 'pages'],
    'workout': ['gym', 'exercise', 'run', 'workout', 'fitness', 'training', 'cardio'],
    'meditate': ['meditate', 'meditation', 'mindfulness', 'yoga'],
    'learn': ['learn', 'study', 'course', 'practice', 'lesson', 'tutorial'],
    'create': ['write', 'create', 'design', 'build', 'make', 'draft'],
    'develop': ['develop', 'development', 'code', 'programming', 'build', 'app'],
  };
  
  let categoryMatch = 0.0;
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    const goalHasKeyword = keywords.some(kw => goalLower.includes(kw));
    const taskHasKeyword = keywords.some(kw => taskLower.includes(kw));
    if (goalHasKeyword && taskHasKeyword) {
      categoryMatch = 0.5;
      break;
    }
  }
  
  // Combine scores
  let similarity = (
    wordSimilarity * 0.4 +
    Math.min(substringMatch, 0.5) * 0.3 +
    categoryMatch * 0.3
  );
  
  // Boost if any match found
  if (wordSimilarity > 0 || substringMatch > 0 || categoryMatch > 0) {
    similarity = Math.max(similarity, 0.25);
  }
  
  return Math.min(similarity, 1.0);
}

/**
 * Find matching goal for a task title
 * Returns the goal if similarity > 0.25, null otherwise
 */
export function findMatchingGoal(taskTitle: string, goals: Goal[]): Goal | null {
  if (!goals || goals.length === 0 || !taskTitle) return null;
  
  let bestMatch: { goal: Goal; similarity: number } | null = null;
  
  for (const goal of goals) {
    if (!goal.title) continue;
    
    const titleSimilarity = calculateGoalTaskSimilarity(goal.title, taskTitle);
    const descSimilarity = goal.description 
      ? calculateGoalTaskSimilarity(goal.description, taskTitle) * 0.7
      : 0;
    
    const similarity = Math.max(titleSimilarity, descSimilarity);
    
    if (similarity > 0.25 && (!bestMatch || similarity > bestMatch.similarity)) {
      bestMatch = { goal, similarity };
    }
  }
  
  return bestMatch?.goal || null;
}

