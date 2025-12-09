// /utils/getGreeting.ts

export function getDynamicGreeting(): string {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 11) {
    // MORNING (Identity • Clarity • Consistency)
    const morning = [
      "Good morning. Let's align your actions with your future self.",
      "A calm start. Focus on the one thing that truly matters today.",
      "Good morning. Your consistency begins right now.",
    ];
    return morning[Math.floor(Math.random() * morning.length)];
  }

  if (hour >= 11 && hour < 14) {
    // MIDDAY (Energy • Promises • Awareness)
    const midday = [
      "Hello. Checking in for midday context.",
      "The most important work is the promise you keep to yourself.",
      "Midday. How is your energy holding up?",
    ];
    return midday[Math.floor(Math.random() * midday.length)];
  }

  if (hour >= 14 && hour < 18) {
    // AFTERNOON (Momentum • Showing Up • Essentialism)
    const afternoon = [
      "Good afternoon. Let's regain gentle momentum.",
      "Focus on showing up for the last few hours.",
      "The day is passing. What is the priority to complete?",
    ];
    return afternoon[Math.floor(Math.random() * afternoon.length)];
  }

  if (hour >= 18 && hour < 22) {
    // EVENING (Reflection • Transition • Compassion)
    const evening = [
      "Good evening. Time to transition gently to yourself.",
      "A moment for reflection: How did you show up today?",
      "Your day is done. Don't forget to celebrate your small wins.",
    ];
    return evening[Math.floor(Math.random() * evening.length)];
  }

  // NIGHT (Rest • Alignment)
  const night = [
    "It is late. You did enough. The day's commitments are complete.",
    "Quiet hours. Rest is part of the work.",
    "Night check-in. Recharge for tomorrow's alignment.",
  ];
  return night[Math.floor(Math.random() * night.length)];
}
