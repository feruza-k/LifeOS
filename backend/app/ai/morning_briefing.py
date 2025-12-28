"""
Morning Briefing Generator for SolAI
Provides proactive insights and priorities when user opens the app
"""
import json
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from app.ai.intelligent_assistant import get_user_context, get_client
from app.logging import logger

tz = None
try:
    import pytz
    tz = pytz.timezone("UTC")
except ImportError:
    pass

async def generate_morning_briefing(user_id: str, user_language: str = "en") -> Dict[str, Any]:
    """
    Generate a proactive morning briefing for the user.
    
    Args:
        user_id: User ID
        user_language: User's preferred language (en, ru, ko, es)
    
    Returns:
        Dict with "greeting", "priorities", "insights", "suggestions"
    """
    try:
        # Get comprehensive user context
        user_context = await get_user_context(user_id)
        
        today = datetime.now(tz) if tz else datetime.utcnow()
        hour = today.hour
        
        # Determine time of day
        if hour < 12:
            time_of_day = "morning"
        elif hour < 17:
            time_of_day = "afternoon"
        else:
            time_of_day = "evening"
        
        tasks_today = user_context.get("tasks_today", [])
        upcoming_tasks = user_context.get("upcoming_tasks", [])
        conflicts = user_context.get("conflicts", [])
        energy = user_context.get("energy", {})
        patterns = user_context.get("patterns", {})
        historical = user_context.get("historical", {})
        
        # Build context for LLM
        today_tasks_summary = []
        for task in tasks_today[:5]:
            if task.get("time"):
                today_tasks_summary.append(f"- {task['title']} at {task['time']}")
            else:
                today_tasks_summary.append(f"- {task['title']} (anytime)")
        
        upcoming_summary = []
        for task in upcoming_tasks[:3]:
            date_str = task.get("date", "unknown")
            time_str = f" at {task['time']}" if task.get("time") else ""
            upcoming_summary.append(f"- {task['title']} on {date_str}{time_str}")
        
        pattern_summary = patterns.get("summary", "")
        energy_status = energy.get("status", "balanced")
        energy_load = energy.get("effectiveLoad", 0)
        
        # Language-specific prompts
        language_prompts = {
            "en": {
                "system": """You are SolAI, a calm and intentional personal assistant. Generate a brief, warm morning briefing in JSON format with:
- greeting: A personalized greeting based on time of day
- priorities: Top 2-3 priorities for today (from tasks)
- insights: One key insight based on patterns or energy
- suggestions: One actionable suggestion

Keep it concise (2-3 sentences per section), warm, and helpful.""",
                "format": {
                    "greeting": "string",
                    "priorities": ["string"],
                    "insights": "string",
                    "suggestions": "string"
                }
            },
            "ru": {
                "system": """Вы SolAI, спокойный и осознанный личный помощник. Создайте краткое, теплое утреннее резюме в формате JSON с:
- greeting: Персонализированное приветствие в зависимости от времени суток
- priorities: Топ 2-3 приоритета на сегодня (из задач)
- insights: Одно ключевое наблюдение на основе паттернов или энергии
- suggestions: Одно практическое предложение

Будьте краткими (2-3 предложения на раздел), теплыми и полезными.""",
                "format": {
                    "greeting": "строка",
                    "priorities": ["строка"],
                    "insights": "строка",
                    "suggestions": "строка"
                }
            },
            "ko": {
                "system": """당신은 SolAI, 차분하고 의도적인 개인 비서입니다. JSON 형식으로 간결하고 따뜻한 아침 브리핑을 생성하세요:
- greeting: 시간대에 따른 개인화된 인사말
- priorities: 오늘의 상위 2-3개 우선순위 (작업에서)
- insights: 패턴이나 에너지를 기반으로 한 핵심 인사이트 하나
- suggestions: 실행 가능한 제안 하나

간결하게 (섹션당 2-3문장), 따뜻하고 도움이 되도록 작성하세요.""",
                "format": {
                    "greeting": "문자열",
                    "priorities": ["문자열"],
                    "insights": "문자열",
                    "suggestions": "문자열"
                }
            },
            "es": {
                "system": """Eres SolAI, un asistente personal tranquilo e intencional. Genera un resumen matutino breve y cálido en formato JSON con:
- greeting: Un saludo personalizado según la hora del día
- priorities: Top 2-3 prioridades para hoy (de las tareas)
- insights: Una idea clave basada en patrones o energía
- suggestions: Una sugerencia accionable

Manténlo conciso (2-3 oraciones por sección), cálido y útil.""",
                "format": {
                    "greeting": "cadena",
                    "priorities": ["cadena"],
                    "insights": "cadena",
                    "suggestions": "cadena"
                }
            }
        }
        
        prompt_config = language_prompts.get(user_language, language_prompts["en"])
        
        user_prompt = f"""Generate a {time_of_day} briefing for the user.

Today's tasks ({len(tasks_today)}):
{chr(10).join(today_tasks_summary) if today_tasks_summary else "No tasks scheduled"}

Upcoming important tasks:
{chr(10).join(upcoming_summary) if upcoming_summary else "None"}

Conflicts: {len(conflicts)} detected

Energy level: {energy_status} (load: {energy_load})

Patterns: {pattern_summary if pattern_summary else "Building patterns..."}

Return JSON with greeting, priorities (array), insights, and suggestions."""
        
        client = get_client()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": prompt_config["system"]},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        
        raw_output = response.choices[0].message.content.strip()
        briefing_data = json.loads(raw_output)
        
        return {
            "greeting": briefing_data.get("greeting", ""),
            "priorities": briefing_data.get("priorities", []),
            "insights": briefing_data.get("insights", ""),
            "suggestions": briefing_data.get("suggestions", ""),
            "time_of_day": time_of_day
        }
        
    except Exception as e:
        logger.error(f"Error generating morning briefing: {e}", exc_info=True)
        # Fallback briefing
        return {
            "greeting": "Good morning! Ready to make today meaningful?",
            "priorities": ["Review your tasks for today", "Focus on what matters most"],
            "insights": "Every day is a fresh start.",
            "suggestions": "Take a moment to align your actions with your goals.",
            "time_of_day": "morning"
        }

