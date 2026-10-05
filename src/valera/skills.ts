export type ValeraProfile = "work" | "home";

export type ValeraAccess = {
  isAdmin: boolean;
  isManager: boolean;
  canViewDashboard: boolean;
  canManageProduction: boolean;
  canViewWarehouse: boolean;
  canViewFinance: boolean;
  canUseScanner: boolean;
};

export type ValeraSkill = {
  id: string;
  profile: ValeraProfile;
  title: string;
  icon: string;
  description: string;
  examples: string[];
  keywords: string[];
  requiresConfirmation: boolean;
  access: (permissions: ValeraAccess) => boolean;
};

export type SkillMatch = {
  skill: ValeraSkill;
  score: number;
};

const workSkills: ValeraSkill[] = [
  {
    id: "production",
    profile: "work",
    title: "Производство",
    icon: "🏭",
    description:
      "Заказы в производство, операции, раскрой, пошив, партии и смены сотрудников.",
    examples: [
      "Закончи раскрой 21 штуки",
      "Сколько сегодня сделали?",
      "Передай партию на следующую операцию",
    ],
    keywords: [
      "производ",
      "раскрой",
      "крой",
      "пошив",
      "стачив",
      "операц",
      "парт",
      "смен",
      "шап",
      "сшил",
      "сделал",
    ],
    requiresConfirmation: true,
    access: (p) => p.canManageProduction,
  },
  {
    id: "printing",
    profile: "work",
    title: "Печать",
    icon: "🖨️",
    description:
      "QR-этикетки, задания на печать и проверка состояния принтера.",
    examples: [
      "Напечатай этикетку партии",
      "Отправь QR на принтер",
      "Принтер сейчас в сети?",
    ],
    keywords: [
      "печат",
      "принтер",
      "этикет",
      "наклейк",
      "qr",
      "кьюар",
      "штрих",
    ],
    requiresConfirmation: true,
    access: (p) => p.canManageProduction || p.isAdmin || p.isManager,
  },
  {
    id: "warehouse",
    profile: "work",
    title: "Склад",
    icon: "📦",
    description:
      "Остатки, поступления, отгрузки, материалы и движение товаров.",
    examples: [
      "Сколько осталось чёрной кулирки?",
      "Покажи последние отгрузки",
      "Что заканчивается на складе?",
    ],
    keywords: [
      "склад",
      "остат",
      "поступ",
      "отгруз",
      "материал",
      "ткан",
      "товар",
      "приход",
      "запас",
    ],
    requiresConfirmation: false,
    access: (p) => p.canViewWarehouse || p.isAdmin || p.isManager,
  },
  {
    id: "analytics",
    profile: "work",
    title: "Аналитика",
    icon: "📊",
    description:
      "Сводки по производству, продажам, планам и текущим показателям.",
    examples: [
      "Как идёт план на весну?",
      "Сколько сделали за неделю?",
      "Покажи общую сводку",
    ],
    keywords: [
      "аналит",
      "свод",
      "план",
      "продаж",
      "озон",
      "ozon",
      "сколько",
      "итог",
      "недел",
      "месяц",
      "выкуп",
    ],
    requiresConfirmation: false,
    access: (p) => p.canViewDashboard || p.isAdmin || p.isManager,
  },
  {
    id: "finance",
    profile: "work",
    title: "Финансы",
    icon: "₽",
    description:
      "Счета, платежи и финансовые показатели ERP для пользователей с доступом.",
    examples: [
      "Покажи движение денег",
      "Какие платежи были сегодня?",
      "Сколько сейчас на счетах?",
    ],
    keywords: [
      "финанс",
      "деньг",
      "счет",
      "платеж",
      "касс",
      "доход",
      "расход",
      "рубл",
    ],
    requiresConfirmation: true,
    access: (p) => p.canViewFinance,
  },
  {
    id: "scanner",
    profile: "work",
    title: "Сканер",
    icon: "⌁",
    description:
      "Переход к QR-сканеру и действия, связанные с производственными кодами.",
    examples: [
      "Открой сканер",
      "Нужно отсканировать партию",
    ],
    keywords: ["скан", "камера", "код", "qr", "кьюар"],
    requiresConfirmation: false,
    access: (p) => p.canUseScanner,
  },
];

const homeSkills: ValeraSkill[] = [
  {
    id: "home-light",
    profile: "home",
    title: "Свет",
    icon: "💡",
    description:
      "Будущий навык управления освещением и сценами умного дома.",
    examples: ["Выключи свет в кухне", "Сделай свет потеплее"],
    keywords: ["свет", "ламп", "освещ", "ярк"],
    requiresConfirmation: false,
    access: () => true,
  },
  {
    id: "home-climate",
    profile: "home",
    title: "Климат",
    icon: "🌡️",
    description:
      "Будущий навык температуры, отопления и климатических устройств.",
    examples: ["Сделай 22 градуса", "Какая температура дома?"],
    keywords: ["температур", "климат", "отоп", "тепл", "холод"],
    requiresConfirmation: false,
    access: () => true,
  },
  {
    id: "home-media",
    profile: "home",
    title: "Медиа",
    icon: "♪",
    description:
      "Будущий навык музыки, колонок и воспроизведения через домашние устройства.",
    examples: ["Включи музыку", "Сделай погромче"],
    keywords: ["музык", "песн", "громк", "звук", "колонк"],
    requiresConfirmation: false,
    access: () => true,
  },
  {
    id: "home-reminders",
    profile: "home",
    title: "Напоминания",
    icon: "⏱",
    description:
      "Будущий навык домашних напоминаний и повторяющихся дел.",
    examples: ["Напомни завтра купить ткань", "Поставь напоминание на вечер"],
    keywords: ["напом", "задач", "вечер", "завтра", "таймер"],
    requiresConfirmation: false,
    access: () => true,
  },
];

export const valeraSkills = [...workSkills, ...homeSkills];

export function getSkillsForProfile(
  profile: ValeraProfile,
  permissions: ValeraAccess
): ValeraSkill[] {
  return valeraSkills.filter(
    (skill) => skill.profile === profile && skill.access(permissions)
  );
}

function normalizeCommand(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[.,!?;:()[\]{}"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function routeValeraCommand(
  command: string,
  profile: ValeraProfile,
  permissions: ValeraAccess
): SkillMatch | null {
  const normalized = normalizeCommand(command);
  if (!normalized) return null;

  const candidates = getSkillsForProfile(profile, permissions);
  let best: SkillMatch | null = null;

  for (const skill of candidates) {
    let score = 0;

    for (const keyword of skill.keywords) {
      if (normalized.includes(keyword)) score += keyword.length;
    }

    if (!best || score > best.score) {
      best = { skill, score };
    }
  }

  return best && best.score > 0 ? best : null;
}
