"""Extract memory candidates from conversations using LLM."""

from typing import List, Optional, Dict, Any
from uuid import UUID
import json
import logging

from app.ai.memory_candidate import MemoryCandidate, create_memory_candidate
from app.ai.memory_taxonomy import MemoryType, get_memory_type_definition
from app.ai.memory_policy import memory_guardrails, validate_memory_candidate
from app.ai.intelligent_assistant import get_client

logger = logging.getLogger(__name__)


class MemoryExtractor:
    """Extracts potential memories from conversations using LLM."""
    
    def extract_candidates(
        self,
        user_message: str,
        assistant_response: str,
        context: Optional[Dict[str, Any]] = None
    ) -> List[MemoryCandidate]:
        """Extract at most one memory candidate per turn using LLM."""
        try:
            candidate = self._extract_with_llm(
                user_message=user_message,
                assistant_response=assistant_response,
                context=context
            )
            
            if candidate and candidate.get("should_store"):
                memory_candidate = self._convert_to_candidate(candidate, user_message, assistant_response)
                logger.info(f"[Memory Extraction] LLM returned should_store=true: {candidate.get('memory_type')} - '{candidate.get('content', '')[:50]}...' (confidence: {candidate.get('confidence', 0):.2f})")
                return [memory_candidate]
            else:
                logger.info(f"[Memory Extraction] LLM returned should_store=false or no candidate. Response: {candidate}")
                return []
        except Exception as e:
            logger.error(f"Error extracting memory candidate: {e}", exc_info=True)
            return []
    
    def _extract_with_llm(
        self,
        user_message: str,
        assistant_response: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """Use LLM to analyze conversation and extract potential memory."""
        # Build context signal hints (read-only, for down-weighting)
        context_hints = self._build_context_hints(context)
        
        # Build prompt for memory extraction
        system_prompt = self._build_extraction_prompt(context_hints)
        
        user_prompt = f"""Analyze this conversation turn:

User: {user_message}

Assistant: {assistant_response}

Extract a potential long-term memory ONLY if:
1. User makes an explicit statement about preferences, constraints, values, or patterns
2. It's NOT inferred from assistant suggestions
3. It's NOT a temporary mood or one-off statement
4. It has high confidence (0.75+ for preferences/values, 0.85+ for constraints, 0.70+ for patterns)

Return JSON:
{{
  "should_store": true | false,
  "memory_type": "preference" | "constraint" | "pattern" | "value" | null,
  "content": "concise memory statement (if should_store is true)",
  "confidence": 0.0-1.0
}}

If no memory should be stored, return:
{{
  "should_store": false,
  "memory_type": null,
  "content": null,
  "confidence": 0.0
}}"""

        try:
            client = get_client()
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                temperature=0.3,  # Lower temperature for more consistent extraction
                response_format={"type": "json_object"}
            )
            
            raw_output = response.choices[0].message.content.strip()
            data = json.loads(raw_output)
            
            return data
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM extraction response as JSON: {e}")
            return None
        except Exception as e:
            logger.error(f"Error calling LLM for memory extraction: {e}", exc_info=True)
            return None
    
    def _build_context_hints(self, context: Optional[Dict[str, Any]]) -> str:
        """Build context hints from context signals for down-weighting temporary signals."""
        if not context:
            return ""
        
        context_signals = context.get("context_signals", {})
        signals = context_signals.get("signals", {})
        drift = context_signals.get("drift", {})
        
        hints = []
        
        # Down-weight if user is in strained period
        if signals.get("sentiment") == "strained":
            hints.append("User is currently experiencing strain - be more conservative with memory extraction")
        
        # Down-weight if overloaded
        if drift.get("overload"):
            hints.append("User appears overloaded - avoid extracting temporary stress-related statements as memories")
        
        # Down-weight if disengaged
        if drift.get("disengagement"):
            hints.append("User engagement is lower - prefer explicit statements over inferred patterns")
        
        if hints:
            return "\n".join(hints)
        return ""
    
    def _build_extraction_prompt(self, context_hints: str) -> str:
        """Build system prompt for memory extraction."""
        base_prompt = """You are a memory extraction system for SolAI. Your job is to identify potential long-term memories from conversations.

Memory Types:
- preference: User's stated or demonstrated preferences (e.g., "I prefer morning workouts", "I like detailed task descriptions")
- constraint: Hard boundaries or non-negotiable rules (e.g., "Cannot work after 6 PM", "No meetings on Fridays")
- pattern: Observed patterns in behavior (e.g., "Completes 80% of tasks scheduled before noon")
- value: Core values or principles (e.g., "Prioritizes family time over work", "Values flexibility over strict scheduling")

Confidence Thresholds:
- preference: 0.75+
- constraint: 0.85+
- pattern: 0.70+
- value: 0.80+

Rules:
1. Extract ONLY from explicit user statements - NEVER infer from assistant suggestions
2. Prefer explicit statements ("I prefer...", "I cannot...", "I value...") over weak inference
3. Reject temporary statements ("today I want...", "this week I can't...")
4. Reject one-off choices without repetition
5. Reject memories that contradict existing patterns
6. Be conservative - only extract if confidence is high

What NOT to extract:
- Temporary moods or one-off statements
- Inferences from assistant suggestions
- Patterns based on fewer than 5 data points
- Preferences inferred from single actions
- Statements with temporal qualifiers ("today", "this week", "for now")"""
        
        if context_hints:
            base_prompt += f"\n\nContext Hints (use to down-weight temporary signals):\n{context_hints}"
        
        return base_prompt
    
    def _convert_to_candidate(
        self,
        llm_output: Dict[str, Any],
        user_message: str,
        assistant_response: str
    ) -> MemoryCandidate:
        """Convert LLM output to MemoryCandidate."""
        memory_type_str = llm_output.get("memory_type")
        if not memory_type_str:
            raise ValueError("memory_type is required when should_store is true")
        
        try:
            memory_type = MemoryType(memory_type_str)
        except ValueError:
            raise ValueError(f"Invalid memory_type: {memory_type_str}")
        
        content = llm_output.get("content", "").strip()
        if not content:
            raise ValueError("content is required when should_store is true")
        
        confidence = float(llm_output.get("confidence", 0.0))
        if not (0.0 <= confidence <= 1.0):
            raise ValueError(f"confidence must be 0.0-1.0, got {confidence}")
        
        return create_memory_candidate(
            content=content,
            memory_type=memory_type,
            confidence=confidence,
            source="conversation",
            metadata={
                "extracted_from": "llm_analysis",
                "user_message_preview": user_message[:100] if user_message else None,
            },
            user_message=user_message,
            assistant_response=assistant_response
        )
    
    def extract_from_explicit_statement(
        self,
        user_message: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Optional[MemoryCandidate]:
        """Extract from explicit statements. Uses LLM extraction."""
        candidates = self.extract_candidates(user_message, "", context)
        return candidates[0] if candidates else None
    
    def validate_and_prepare_candidate(
        self,
        candidate: MemoryCandidate
    ) -> tuple[bool, Optional[MemoryCandidate]]:
        """Validate candidate and prepare for storage."""
        is_valid, errors = validate_memory_candidate(candidate)
        
        if is_valid:
            candidate.should_store = True
            return True, candidate
        else:
            candidate.should_store = False
            candidate.validation_errors = errors
            logger.debug(
                f"Memory candidate rejected: {candidate.content[:50]}... "
                f"Errors: {', '.join(errors)}"
            )
            return False, None
    
    def extract_from_pattern_analysis(
        self,
        pattern_data: Dict[str, Any],
        confidence: float
    ) -> Optional[MemoryCandidate]:
        """Extract from pattern analysis. Placeholder for future implementation."""
        # This will be implemented when pattern-based extraction is needed
        return None


memory_extractor = MemoryExtractor()


def extract_memory_candidates(
    user_message: str,
    assistant_response: str,
    context: Optional[Dict[str, Any]] = None
) -> List[MemoryCandidate]:
    """Extract memory candidates from conversation."""
    return memory_extractor.extract_candidates(
        user_message=user_message,
        assistant_response=assistant_response,
        context=context
    )


def create_memory_candidate_manual(
    content: str,
    memory_type: MemoryType,
    confidence: float,
    source: str = "explicit",
    metadata: Optional[Dict[str, Any]] = None,
    user_message: Optional[str] = None,
    assistant_response: Optional[str] = None,
) -> MemoryCandidate:
    """Create memory candidate manually (for testing/debugging)."""
    return create_memory_candidate(
        content=content,
        memory_type=memory_type,
        confidence=confidence,
        source=source,
        metadata=metadata,
        user_message=user_message,
        assistant_response=assistant_response,
    )
