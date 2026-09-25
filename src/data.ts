export type HeroId =
  | "nezha"
  | "erlang"
  | "wukong"
  | "change"
  | "jiang"
  | "fox"
  | "aobing"
  | "phoenix"
  | "xuanwu"
  | "tiger"
  | "nuwa"
  | "lei"
  | "houyi"
  | "gonggong"
  | "zhurong"
  | "chiyou"
  | "jingwei"
  | "fuxi"
  | "daji"
  | "shennong"
  | "zhongkui"
  | "yanluo"
  | "mengpo"
  | "bai";
export interface Hero {
  id: HeroId;
  name: string;
  title: string;
  origin: string;
  role: string;
  cost: number;
  hp: number;
  atk: number;
  armor: number;
  range: number;
  speed: number;
  skill: string;
  description: string;
  color: string;
  art: number;
}
export const HEROES: Hero[] = [
  {
    id: "nezha",
    name: "哪吒",
    title: "三坛海会大神",
    origin: "昆仑",
    role: "战将",
    cost: 1,
    hp: 720,
    atk: 64,
    armor: 18,
    range: 1,
    speed: 1.05,
    skill: "风火轮",
    description:
      "掷出乾坤圈，对目标及相邻敌人造成 180% 攻击伤害，并回复自身 15% 生命。",
    color: "#b96146",
    art: 0,
  },
  {
    id: "erlang",
    name: "杨戬",
    title: "清源妙道真君",
    origin: "昆仑",
    role: "战将",
    cost: 3,
    hp: 980,
    atk: 82,
    armor: 28,
    range: 1,
    speed: 1,
    skill: "天眼破妄",
    description: "天眼锁定最虚弱的敌人，造成 360% 攻击伤害，无视护甲。",
    color: "#6b8e92",
    art: 1,
  },
  {
    id: "wukong",
    name: "孙悟空",
    title: "齐天大圣",
    origin: "灵山",
    role: "战将",
    cost: 4,
    hp: 1080,
    atk: 95,
    armor: 25,
    range: 1,
    speed: 1.15,
    skill: "大闹天宫",
    description: "挥舞金箍棒，对附近所有敌人造成 240% 攻击伤害，眩晕 1 秒。",
    color: "#b58a3d",
    art: 2,
  },
  {
    id: "change",
    name: "嫦娥",
    title: "广寒仙子",
    origin: "月宫",
    role: "灵祝",
    cost: 2,
    hp: 560,
    atk: 52,
    armor: 12,
    range: 3,
    speed: 0.85,
    skill: "月华流照",
    description: "为生命最低的两位友军回复 28% 最大生命，自身获得月华护盾。",
    color: "#92aaa0",
    art: 3,
  },
  {
    id: "jiang",
    name: "姜子牙",
    title: "昆仑太公",
    origin: "昆仑",
    role: "灵祝",
    cost: 1,
    hp: 570,
    atk: 47,
    armor: 12,
    range: 3,
    speed: 0.85,
    skill: "封神敕令",
    description: "为全体友军回复 12% 最大生命，并赐予 15 点法力。",
    color: "#8c997b",
    art: 4,
  },
  {
    id: "fox",
    name: "九尾",
    title: "青丘狐仙",
    origin: "青丘",
    role: "幻师",
    cost: 2,
    hp: 580,
    atk: 67,
    armor: 10,
    range: 3,
    speed: 0.95,
    skill: "倾城狐火",
    description:
      "狐火追击最远的敌人，造成 320% 攻击伤害，魅惑 1.5 秒；魅惑期间无法行动。",
    color: "#aa8eaf",
    art: 5,
  },
  {
    id: "aobing",
    name: "敖丙",
    title: "东海龙太子",
    origin: "龙宫",
    role: "战将",
    cost: 2,
    hp: 840,
    atk: 68,
    armor: 22,
    range: 1,
    speed: 1,
    skill: "沧海龙吟",
    description: "寒潮击中目标及相邻敌人，造成 200% 攻击伤害，眩晕 1 秒。",
    color: "#599eaa",
    art: 6,
  },
  {
    id: "phoenix",
    name: "朱雀",
    title: "南明神鸟",
    origin: "灵山",
    role: "术士",
    cost: 3,
    hp: 660,
    atk: 82,
    armor: 14,
    range: 3,
    speed: 0.95,
    skill: "南明离火",
    description:
      "火羽席卷全体敌人，造成 150% 攻击伤害，并灼烧 4 秒，每秒造成 25% 攻击伤害。",
    color: "#b56445",
    art: 7,
  },
  {
    id: "xuanwu",
    name: "玄武",
    title: "北冥镇守",
    origin: "龙宫",
    role: "守御",
    cost: 1,
    hp: 1120,
    atk: 38,
    armor: 40,
    range: 1,
    speed: 0.7,
    skill: "玄冥甲",
    description: "获得相当于最大生命 35% 的护盾，并为附近友军回复 10% 生命。",
    color: "#587d6c",
    art: 8,
  },
  {
    id: "tiger",
    name: "白虎",
    title: "西方战神",
    origin: "月宫",
    role: "守御",
    cost: 2,
    hp: 1080,
    atk: 62,
    armor: 34,
    range: 1,
    speed: 0.85,
    skill: "白虎啸天",
    description: "猛击目标，造成 280% 攻击伤害，自身获得最大生命 20% 的护盾。",
    color: "#9ca69f",
    art: 9,
  },
  {
    id: "nuwa",
    name: "女娲",
    title: "万灵之母",
    origin: "青丘",
    role: "灵祝",
    cost: 5,
    hp: 860,
    atk: 86,
    armor: 20,
    range: 3,
    speed: 0.9,
    skill: "五色补天",
    description:
      "五色石为全体友军回复 24% 生命，并对全体敌人造成 160% 攻击伤害。",
    color: "#559580",
    art: 10,
  },
  {
    id: "lei",
    name: "雷震子",
    title: "风雷双翼",
    origin: "昆仑",
    role: "术士",
    cost: 3,
    hp: 740,
    atk: 84,
    armor: 18,
    range: 3,
    speed: 1.1,
    skill: "九天惊雷",
    description: "连锁雷霆击中三名敌人，依次造成 260%、210%、160% 攻击伤害。",
    color: "#6f94a9",
    art: 11,
  },
  {
    id: "houyi",
    name: "后羿",
    title: "射日神弓",
    origin: "月宫",
    role: "游侠",
    cost: 3,
    hp: 650,
    atk: 88,
    armor: 12,
    range: 4,
    speed: 1.1,
    skill: "九日连珠",
    description:
      "向生命最高的敌人连射三支穿云箭，每支造成 150% 攻击伤害。被动：每第三次普攻额外造成 50% 伤害。",
    color: "#b09959",
    art: 12,
  },
  {
    id: "gonggong",
    name: "共工",
    title: "北方水神",
    origin: "龙宫",
    role: "术士",
    cost: 4,
    hp: 950,
    atk: 80,
    armor: 22,
    range: 2,
    speed: 0.9,
    skill: "怒海倾天",
    description:
      "洪流淹没敌方前排，造成 220% 攻击伤害并冰冻 1.5 秒。全体友军获得 10% 最大生命护盾。",
    color: "#5897ad",
    art: 13,
  },
  {
    id: "zhurong",
    name: "祝融",
    title: "南方火神",
    origin: "九黎",
    role: "术士",
    cost: 3,
    hp: 690,
    atk: 85,
    armor: 14,
    range: 3,
    speed: 0.9,
    skill: "焚天炎狱",
    description:
      "在目标周围降下炎狱，造成 200% 攻击伤害并灼烧 5 秒。已灼烧的目标额外承受 100% 攻击伤害。",
    color: "#c36e44",
    art: 14,
  },
  {
    id: "chiyou",
    name: "蚩尤",
    title: "兵主战神",
    origin: "九黎",
    role: "守御",
    cost: 4,
    hp: 1450,
    atk: 83,
    armor: 42,
    range: 1,
    speed: 0.8,
    skill: "兵主降临",
    description:
      "嘲讽附近敌人 3 秒，获得 30% 最大生命护盾；每次受击反伤 25% 攻击力。",
    color: "#82694c",
    art: 15,
  },
  {
    id: "jingwei",
    name: "精卫",
    title: "填海神鸟",
    origin: "蓬莱",
    role: "游侠",
    cost: 1,
    hp: 510,
    atk: 53,
    armor: 10,
    range: 3,
    speed: 1.15,
    skill: "衔石逐浪",
    description:
      "投石造成 220% 攻击伤害，并召唤一只拥有自身 35% 生命与攻击的幻羽，持续协战。最多两只。",
    color: "#c68d72",
    art: 16,
  },
  {
    id: "fuxi",
    name: "伏羲",
    title: "八卦祖神",
    origin: "蓬莱",
    role: "灵祝",
    cost: 5,
    hp: 920,
    atk: 79,
    armor: 24,
    range: 3,
    speed: 0.85,
    skill: "先天八卦",
    description:
      "布下八卦阵，使全体友军获得 25% 最大生命护盾与 5 秒急速（攻速 +35%），解除控制。",
    color: "#648d74",
    art: 17,
  },
  {
    id: "daji",
    name: "妲己",
    title: "倾世妖姬",
    origin: "青丘",
    role: "幻师",
    cost: 3,
    hp: 620,
    atk: 77,
    armor: 12,
    range: 3,
    speed: 0.95,
    skill: "摄魂魅影",
    description:
      "魅惑攻击最高的敌人 2.5 秒，造成 250% 攻击伤害，并使其破甲 6 秒（护甲 -25）。",
    color: "#b07da1",
    art: 18,
  },
  {
    id: "shennong",
    name: "神农",
    title: "百草药祖",
    origin: "九黎",
    role: "灵祝",
    cost: 2,
    hp: 750,
    atk: 45,
    armor: 18,
    range: 3,
    speed: 0.8,
    skill: "百草回春",
    description:
      "净化全队灼烧，治疗生命最低的友军 35% 最大生命，并赋予 5 秒回春（每秒回复 4% 生命）。",
    color: "#83936a",
    art: 19,
  },
  {
    id: "zhongkui",
    name: "钟馗",
    title: "伏魔帝君",
    origin: "幽冥",
    role: "守御",
    cost: 2,
    hp: 1120,
    atk: 57,
    armor: 35,
    range: 1,
    speed: 0.8,
    skill: "镇魂锁",
    description:
      "将最远的敌人拉到身前，造成 200% 攻击伤害，并镇压 2 秒。优先破坏敌方后排。",
    color: "#a2634e",
    art: 20,
  },
  {
    id: "yanluo",
    name: "阎罗",
    title: "幽冥判官",
    origin: "幽冥",
    role: "术士",
    cost: 5,
    hp: 890,
    atk: 98,
    armor: 22,
    range: 3,
    speed: 0.85,
    skill: "生死簿",
    description:
      "审判生命比例最低的敌人：低于 25% 生命时直接斩杀，否则造成 400% 攻击真实伤害。",
    color: "#867196",
    art: 21,
  },
  {
    id: "mengpo",
    name: "孟婆",
    title: "忘川引渡人",
    origin: "幽冥",
    role: "灵祝",
    cost: 1,
    hp: 600,
    atk: 44,
    armor: 15,
    range: 3,
    speed: 0.85,
    skill: "忘川一梦",
    description:
      "忘川雾使全体敌人法力减少 30，缓速 3 秒（攻速 -30%），并为最虚弱的友军回复 25% 生命。",
    color: "#739c97",
    art: 22,
  },
  {
    id: "bai",
    name: "白无常",
    title: "勾魂使者",
    origin: "幽冥",
    role: "游侠",
    cost: 2,
    hp: 610,
    atk: 67,
    armor: 13,
    range: 3,
    speed: 1.05,
    skill: "无常索命",
    description:
      "魂链击中生命最低的两位敌人，造成 240% 攻击伤害。每击败一位敌人，永久增加本场 15% 攻击力。",
    color: "#91a5a2",
    art: 23,
  },
];
export const hero = (id: HeroId) => HEROES.find((h) => h.id === id)!;
export const COST_COLORS = [
  "",
  "#8b9b87",
  "#5a9c95",
  "#628fa8",
  "#ab87b3",
  "#c39a4f",
];
export const TRAITS: Record<
  string,
  { icon: string; thresholds: number[]; description: string }
> = {
  昆仑: {
    icon: "山",
    thresholds: [2, 4],
    description: "昆仑英灵初始获得 25 / 50 点法力。",
  },
  灵山: {
    icon: "禅",
    thresholds: [2],
    description: "灵山英灵攻击速度提升 25%。",
  },
  月宫: {
    icon: "月",
    thresholds: [2, 3],
    description: "月宫英灵每秒回复 2% / 3.5% 最大生命。",
  },
  青丘: {
    icon: "狐",
    thresholds: [2, 3],
    description: "青丘英灵技能效果提升 30% / 55%。",
  },
  龙宫: {
    icon: "龙",
    thresholds: [2, 3],
    description: "龙宫英灵最大生命提升 20% / 35%，控制持续时间提升 15% / 30%。",
  },
  九黎: {
    icon: "炎",
    thresholds: [2, 3],
    description:
      "九黎英灵造成伤害的 15% / 25% 转化为自身治疗。全队灼烧伤害提升 30% / 60%。",
  },
  蓬莱: {
    icon: "仙",
    thresholds: [2],
    description:
      "全体友军受到的治疗和护盾增加 25%。幻羽召唤物额外获得 50% 生命。",
  },
  幽冥: {
    icon: "魂",
    thresholds: [2, 4],
    description:
      "幽冥英灵首次倒下时，以 20% / 40% 最大生命复苏，并获得 30 法力。",
  },
  战将: {
    icon: "戈",
    thresholds: [2, 4],
    description: "战将攻击力提升 18% / 40%。",
  },
  守御: {
    icon: "甲",
    thresholds: [2, 3],
    description: "守御护甲增加 25 / 45 点；开局获得 12% / 20% 最大生命护盾。",
  },
  灵祝: {
    icon: "灵",
    thresholds: [2, 3],
    description: "灵祝施法时额外治疗全队 4% / 7% 最大生命。",
  },
  术士: {
    icon: "咒",
    thresholds: [2, 3],
    description: "术士技能效果提升 25% / 50%。",
  },
  游侠: {
    icon: "弓",
    thresholds: [2, 3],
    description:
      "游侠攻速提升 20% / 35%，每第三次普攻额外发射一箭（50% / 80% 攻击伤害）。",
  },
  幻师: {
    icon: "魅",
    thresholds: [2],
    description: "幻师控制时间延长 40%，对被控制的敌人伤害提升 25%。",
  },
};
export interface Bond {
  id: string;
  name: string;
  heroes: HeroId[];
  description: string;
}
export const BONDS: Bond[] = [
  {
    id: "lotus-dragon",
    name: "莲生沧海",
    heroes: ["nezha", "aobing"],
    description: "哪吒与敖丙每次施法，为彼此回复 12% 最大生命。",
  },
  {
    id: "sun-moon",
    name: "日月同辉",
    heroes: ["houyi", "change"],
    description: "后羿攻击提升 20%；嫦娥治疗效果提升 25%。",
  },
  {
    id: "creation",
    name: "创世双神",
    heroes: ["fuxi", "nuwa"],
    description: "全体英灵生命提升 12%，初始法力增加 15。",
  },
  {
    id: "fire-water",
    name: "水火既济",
    heroes: ["gonggong", "zhurong"],
    description:
      "共工与祝融伤害提升 25%，攻击同时被灼烧与控制的敌人时再增 30%。",
  },
  {
    id: "heaven",
    name: "天庭双圣",
    heroes: ["wukong", "erlang"],
    description: "杨戬与悟空攻击提升 15%，开局获得 25% 生命护盾。",
  },
  {
    id: "foxes",
    name: "青丘双姝",
    heroes: ["fox", "daji"],
    description: "九尾与妲己每次施法后额外回复 20 法力。",
  },
  {
    id: "judges",
    name: "冥府判官",
    heroes: ["zhongkui", "yanluo"],
    description:
      "钟馗与阎罗获得 15% 伤害吸血，对生命低于 35% 的目标伤害提升 20%。",
  },
  {
    id: "herbs",
    name: "神农百草",
    heroes: ["shennong", "chiyou"],
    description: "蚩尤最大生命增加 20%；神农初始法力增加 40。",
  },
];
export interface Build {
  id: string;
  name: string;
  subtitle: string;
  glyph: string;
  heroes: HeroId[];
  traits: string[];
  tip: string;
}
export const BUILDS: Build[] = [
  {
    id: "kunlun",
    name: "昆仑天雷",
    subtitle: "先手爆发 · 连锁施法",
    glyph: "雷",
    heroes: ["nezha", "jiang", "erlang", "lei", "phoenix", "xuanwu", "aobing"],
    traits: ["昆仑", "术士", "战将"],
    tip: "四昆仑获得大量初始法力，雷震子与朱雀后排齐射，哪吒和杨戬在前排承伤。",
  },
  {
    id: "dragon",
    name: "沧海冰封",
    subtitle: "群体控制 · 坚甲反击",
    glyph: "龙",
    heroes: [
      "aobing",
      "xuanwu",
      "gonggong",
      "tiger",
      "change",
      "zhurong",
      "nezha",
    ],
    traits: ["龙宫", "守御", "月宫"],
    tip: "三龙宫延长控制，玄武白虎扛住前排，共工冰封战场。补祝融激活水火既济。",
  },
  {
    id: "fox",
    name: "青丘魅影",
    subtitle: "锁定后排 · 控制连携",
    glyph: "狐",
    heroes: ["fox", "daji", "nuwa", "xuanwu", "zhongkui", "mengpo", "yanluo"],
    traits: ["青丘", "幻师", "幽冥"],
    tip: "双幻师连续魅惑敌方主力，钟馗勾出后排；女娲提供续航，避免脆弱的幻师正面接敌。",
  },
  {
    id: "fire",
    name: "九黎业火",
    subtitle: "持续灼烧 · 浴火吸血",
    glyph: "炎",
    heroes: [
      "zhurong",
      "chiyou",
      "shennong",
      "phoenix",
      "gonggong",
      "lei",
      "xuanwu",
    ],
    traits: ["九黎", "术士", "守御"],
    tip: "三九黎提供吸血，祝融与朱雀叠加灼烧。蚩尤嘲讽守前排，神农防止队伍被持续伤害消耗。",
  },
  {
    id: "moon",
    name: "月宫逐日",
    subtitle: "远程齐射 · 持续恢复",
    glyph: "弓",
    heroes: ["houyi", "change", "tiger", "jingwei", "bai", "xuanwu", "fuxi"],
    traits: ["月宫", "游侠", "蓬莱"],
    tip: "白虎顶前，后羿放角落，嫦娥伴其侧。三游侠带来密集箭雨，注意敌方钟馗的拉人。",
  },
  {
    id: "spirit",
    name: "幽冥轮回",
    subtitle: "倒下复苏 · 残血收割",
    glyph: "魂",
    heroes: ["zhongkui", "yanluo", "mengpo", "bai", "xuanwu", "fox", "daji"],
    traits: ["幽冥", "守御", "幻师"],
    tip: "四幽冥获得一次高额复苏，阎罗负责斩杀。钟馗与阎罗组成冥府判官，越战越强。",
  },
  {
    id: "immortal",
    name: "蓬莱长生",
    subtitle: "幻羽召唤 · 护盾治疗",
    glyph: "仙",
    heroes: [
      "jingwei",
      "fuxi",
      "nuwa",
      "shennong",
      "xuanwu",
      "chiyou",
      "change",
    ],
    traits: ["蓬莱", "灵祝", "守御"],
    tip: "双蓬莱强化全队治疗与护盾。精卫不断召唤幻羽，三灵祝维持生命，适合消耗战。",
  },
  {
    id: "warrior",
    name: "斗战封神",
    subtitle: "近战突击 · 双圣合璧",
    glyph: "战",
    heroes: [
      "nezha",
      "aobing",
      "erlang",
      "wukong",
      "jiang",
      "change",
      "phoenix",
    ],
    traits: ["战将", "昆仑", "灵山"],
    tip: "四战将获得强力攻击加成，哪吒敖丙互相治疗；悟空与杨戬的双圣护盾保证第一波突击。",
  },
];
export const PASSIVES: Record<HeroId, string> = {
  nezha: "莲身：普攻回复自身最大生命的 1%。",
  erlang: "天眼：对有护盾的目标额外造成 20% 伤害。",
  wukong: "斗战：生命低于一半时，攻速提高 30%。",
  change: "月佑：受到的治疗增加 15%。",
  jiang: "敕令：普攻额外回复自身 5 法力。",
  fox: "狐影：对受控制的目标，技能效果提高 15%。",
  aobing: "龙鳞：开局获得 12% 生命护盾。",
  phoenix: "浴火：首次倒下时以 18% 生命复苏。",
  xuanwu: "龟甲：受到的普攻伤害减少 12%。",
  tiger: "杀伐：目标生命低于一半时伤害增加 20%。",
  nuwa: "造化：受到的治疗和护盾提升 15%。",
  lei: "雷息：普攻额外回复自身 5 法力。",
  houyi: "破日：每第三次普攻额外造成 50% 伤害。",
  gonggong: "水御：开局获得 12% 生命护盾。",
  zhurong: "炎心：对已灼烧的目标伤害增加 15%。",
  chiyou: "反戈：嘲讽期间受到普攻时反击。",
  jingwei: "执念：生命低于一半时攻速提高 20%。",
  fuxi: "推演：开局获得 20 法力。",
  daji: "妖心：普攻额外回复自身 5 法力。",
  shennong: "尝草：受到治疗效果增加 20%。",
  zhongkui: "伏魔：对护盾目标额外造成 20% 伤害。",
  yanluo: "审判：对残血目标伤害增加 15%。",
  mengpo: "忘忧：开局获得 20 法力。",
  bai: "索命：每击败一人，本场攻击提升 15%。",
};
export { MAX_ROUNDS, XP_NEEDED } from "./rules";
export const EVENTS = [
  {
    id: "peach",
    name: "瑶池蟠桃",
    description: "云雾散开，仙人留下一盘蟠桃与一卷道书。",
    choices: [
      {
        id: "heal",
        name: "品尝蟠桃",
        description: "回复 15 气血",
        glyph: "桃",
      },
      {
        id: "study",
        name: "参悟道书",
        description: "获得 8 阅历",
        glyph: "书",
      },
    ],
  },
  {
    id: "merchant",
    name: "云游商人",
    description: "山间商人愿以灵石交换你的一缕精气，也可赠你些盘缠。",
    choices: [
      {
        id: "trade",
        name: "以气换石",
        description: "失去 10 气血，获得 16 灵石",
        glyph: "契",
      },
      { id: "gold", name: "结一善缘", description: "获得 7 灵石", glyph: "缘" },
    ],
  },
  {
    id: "spring",
    name: "昆仑灵泉",
    description: "灵泉一旁，山神的宝匣静候有缘人。",
    choices: [
      {
        id: "heal",
        name: "饮一瓢灵泉",
        description: "回复 15 气血",
        glyph: "泉",
      },
      {
        id: "gift",
        name: "开启宝匣",
        description: "获得一位随机 3 费英灵（备战席需有空位）",
        glyph: "匣",
      },
    ],
  },
];
export interface Relic {
  id: string;
  name: string;
  glyph: string;
  description: string;
  short: string;
}
export const RELICS: Relic[] = [
  {
    id: "sword",
    name: "诛仙剑",
    glyph: "剑",
    description: "全体英灵攻击力提升 18%。一剑出，万法寂。",
    short: "攻击 +18%",
  },
  {
    id: "jade",
    name: "昆仑玉",
    glyph: "玉",
    description: "全体英灵最大生命提升 22%。玉蕴山海，生生不息。",
    short: "生命 +22%",
  },
  {
    id: "bell",
    name: "东皇钟",
    glyph: "钟",
    description: "全体英灵护甲增加 18 点。钟鸣九霄，万邪不侵。",
    short: "护甲 +18",
  },
  {
    id: "lotus",
    name: "九品莲",
    glyph: "莲",
    description: "全体英灵初始获得 35 点法力。莲开一念，道法自成。",
    short: "初始法力 +35",
  },
  {
    id: "fan",
    name: "芭蕉扇",
    glyph: "风",
    description: "全体英灵攻击速度提升 20%。一扇清风，万里无尘。",
    short: "攻速 +20%",
  },
  {
    id: "coin",
    name: "聚宝盆",
    glyph: "宝",
    description: "立刻获得 12 灵石，之后每轮额外获得 2 灵石。",
    short: "每轮灵石 +2",
  },
];
RELICS.push(
  {
    id: "study",
    name: "悟道之心",
    glyph: "悟",
    description: "立即获得 12 阅历，每轮额外获得 2 阅历。",
    short: "阅历加速",
  },
  {
    id: "savings",
    name: "天禄赐福",
    glyph: "禄",
    description: "利息上限提高至 7，立即获得 10 灵石。",
    short: "利息上限 7",
  },
  {
    id: "scholar",
    name: "万法归宗",
    glyph: "法",
    description: "全体英灵技能强度提升 25%。",
    short: "法强 +25%",
  },
  {
    id: "vampire",
    name: "饮血归元",
    glyph: "血",
    description: "全体英灵造成伤害的 12% 回复自身生命。",
    short: "吸血 +12%",
  },
  {
    id: "ward",
    name: "护山大阵",
    glyph: "盾",
    description: "全体英灵开战获得 20% 最大生命护盾。",
    short: "开战护盾",
  },
  {
    id: "spring",
    name: "枯木逢春",
    glyph: "春",
    description: "全体英灵每秒回复 1% 最大生命。",
    short: "持续回复",
  },
  {
    id: "forge",
    name: "神工天授",
    glyph: "铸",
    description: "立即获得 3 件随机基础装备。",
    short: "获得 3 散件",
  },
  {
    id: "arsenal",
    name: "天工宝库",
    glyph: "匣",
    description: "立即获得 1 件随机成装及 5 灵石。",
    short: "获得成装",
  },
  {
    id: "rescue",
    name: "绝处逢生",
    glyph: "生",
    description: "立即回复 20 气血，全体英灵生命增加 8%。",
    short: "回复气血",
  },
  {
    id: "balance",
    name: "文武双修",
    glyph: "衡",
    description: "全体英灵攻击提升 10%，技能强度提升 12%。",
    short: "双系增伤",
  },
  {
    id: "swift",
    name: "破阵疾行",
    glyph: "迅",
    description: "全体英灵攻速提高 12%，初始法力增加 15。",
    short: "攻速与法力",
  },
  {
    id: "treasure",
    name: "横财天降",
    glyph: "金",
    description: "立即获得 25 灵石。",
    short: "灵石 +25",
  },
);
export const ROUND_NAMES = [
  "山门初试",
  "林间灵兽",
  "云海巡游",
  "镇山神将",
  "瑶池来客",
  "月下狐影",
  "龙宫使者",
  "四象之阵",
  "天阙守卫",
  "风雷劫阵",
  "万灵归位",
  "混沌天劫",
];
export const REGIONS = ["昆仑山门", "瑶池幻境", "不周天阙"];
