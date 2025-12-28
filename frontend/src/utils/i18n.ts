/**
 * Internationalization (i18n) Support
 * Provides translations for Russian, Korean, Spanish, and English
 */

export type Language = "en" | "ru" | "ko" | "es";

interface Translations {
  [key: string]: {
    en: string;
    ru: string;
    ko: string;
    es: string;
  };
}

const translations: Translations = {
  // Common
  "common.today": {
    en: "Today",
    ru: "Сегодня",
    ko: "오늘",
    es: "Hoy",
  },
  "common.tomorrow": {
    en: "Tomorrow",
    ru: "Завтра",
    ko: "내일",
    es: "Mañana",
  },
  "common.add": {
    en: "Add",
    ru: "Добавить",
    ko: "추가",
    es: "Añadir",
  },
  "common.save": {
    en: "Save",
    ru: "Сохранить",
    ko: "저장",
    es: "Guardar",
  },
  "common.cancel": {
    en: "Cancel",
    ru: "Отмена",
    ko: "취소",
    es: "Cancelar",
  },
  "common.delete": {
    en: "Delete",
    ru: "Удалить",
    ko: "삭제",
    es: "Eliminar",
  },
  "common.edit": {
    en: "Edit",
    ru: "Редактировать",
    ko: "편집",
    es: "Editar",
  },
  "common.close": {
    en: "Close",
    ru: "Закрыть",
    ko: "닫기",
    es: "Cerrar",
  },

  // Navigation
  "nav.today": {
    en: "Today",
    ru: "Сегодня",
    ko: "오늘",
    es: "Hoy",
  },
  "nav.week": {
    en: "Week",
    ru: "Неделя",
    ko: "주",
    es: "Semana",
  },
  "nav.calendar": {
    en: "Calendar",
    ru: "Календарь",
    ko: "캘린더",
    es: "Calendario",
  },
  "nav.explore": {
    en: "Explore",
    ru: "Обзор",
    ko: "탐색",
    es: "Explorar",
  },
  "nav.notes": {
    en: "Notes",
    ru: "Заметки",
    ko: "노트",
    es: "Notas",
  },
  "nav.reminders": {
    en: "Reminders",
    ru: "Напоминания",
    ko: "리마인더",
    es: "Recordatorios",
  },
  "nav.settings": {
    en: "Settings",
    ru: "Настройки",
    ko: "설정",
    es: "Configuración",
  },

  // SolAI
  "solai.greeting": {
    en: "Hello! How can I help you today?",
    ru: "Привет! Чем могу помочь?",
    ko: "안녕하세요! 오늘 무엇을 도와드릴까요?",
    es: "¡Hola! ¿Cómo puedo ayudarte hoy?",
  },
  "solai.thinking": {
    en: "Thinking...",
    ru: "Думаю...",
    ko: "생각 중...",
    es: "Pensando...",
  },
  "solai.voice.listen": {
    en: "Listening...",
    ru: "Слушаю...",
    ko: "듣는 중...",
    es: "Escuchando...",
  },
  "solai.voice.speak": {
    en: "Speaking...",
    ru: "Говорю...",
    ko: "말하는 중...",
    es: "Hablando...",
  },

  // Tasks
  "task.add": {
    en: "Add Task",
    ru: "Добавить задачу",
    ko: "작업 추가",
    es: "Añadir tarea",
  },
  "task.complete": {
    en: "Complete",
    ru: "Выполнено",
    ko: "완료",
    es: "Completar",
  },
  "task.edit": {
    en: "Edit Task",
    ru: "Редактировать задачу",
    ko: "작업 편집",
    es: "Editar tarea",
  },

  // Settings
  "settings.language": {
    en: "Language",
    ru: "Язык",
    ko: "언어",
    es: "Idioma",
  },
  "settings.timezone": {
    en: "Timezone",
    ru: "Часовой пояс",
    ko: "시간대",
    es: "Zona horaria",
  },
  "settings.notifications": {
    en: "Notifications",
    ru: "Уведомления",
    ko: "알림",
    es: "Notificaciones",
  },
};

class I18n {
  private currentLanguage: Language = "en";

  constructor() {
    // Load language from localStorage or browser
    const saved = localStorage.getItem("lifeos_language") as Language;
    if (saved && ["en", "ru", "ko", "es"].includes(saved)) {
      this.currentLanguage = saved;
    } else {
      // Try to detect from browser
      const browserLang = navigator.language.split("-")[0];
      if (["en", "ru", "ko", "es"].includes(browserLang)) {
        this.currentLanguage = browserLang as Language;
      }
    }
  }

  setLanguage(lang: Language): void {
    this.currentLanguage = lang;
    localStorage.setItem("lifeos_language", lang);
    // Update document language
    document.documentElement.lang = lang;
  }

  getLanguage(): Language {
    return this.currentLanguage;
  }

  t(key: string, fallback?: string): string {
    const translation = translations[key];
    if (!translation) {
      return fallback || key;
    }
    return translation[this.currentLanguage] || translation.en || fallback || key;
  }

  // Format date according to language
  formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
    const localeMap: Record<Language, string> = {
      en: "en-US",
      ru: "ru-RU",
      ko: "ko-KR",
      es: "es-ES",
    };
    return new Intl.DateTimeFormat(localeMap[this.currentLanguage], options).format(date);
  }

  // Format time according to language
  formatTime(date: Date): string {
    return this.formatDate(date, { hour: "numeric", minute: "2-digit" });
  }
}

export const i18n = new I18n();

