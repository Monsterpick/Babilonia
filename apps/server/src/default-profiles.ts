import { ProfileSchema, type Profile, type ProfileInput } from '@livearena/shared'

/**
 * Perfil de ejemplo «Supervivencia»: solo comandos vanilla (funciona en cualquier servidor
 * Paper/Vanilla 1.20.1+). Los comandos de tus plugins (p. ej. `trueno {nick} {quien}`) se
 * añaden como acciones "minecraft.command" cuando instales los .jar.
 */
type ActionInput = NonNullable<ProfileInput['actions']>[number]

const mob = (id: string, name: string, color: string, entity: string, count = 1, alignment: 'good' | 'bad' = 'bad'): ActionInput => ({
  id,
  name,
  color,
  alignment,
  steps: [
    { type: 'minecraft.summon', entity, count, nameTag: true, radius: 4 },
    { type: 'minecraft.title', actionbar: `{user} → ${name}`, color: '#ffcc00' },
  ],
})

export function defaultProfiles(): Profile[] {
  const supervivencia: ProfileInput = {
    id: 'supervivencia',
    name: 'Supervivencia',
    mode: 'supervivencia',
    actions: [
      mob('warden', 'WARDEN', '#0e7490', 'warden'),
      {
        id: 'trueno',
        name: 'TRUENO',
        color: '#ef4444',
        alignment: 'bad',
        steps: [
          { type: 'minecraft.command', commands: ['execute at {player} run summon lightning_bolt ~2 ~ ~2'] },
          { type: 'minecraft.title', actionbar: '⚡ {user} te lanzó un trueno', color: '#ffcc00' },
        ],
      },
      {
        id: 'tnt',
        name: 'TNT',
        color: '#dc2626',
        alignment: 'bad',
        steps: [
          { type: 'minecraft.command', commands: ['execute at {player} run summon tnt ~ ~4 ~ {Fuse:50}'] },
          { type: 'minecraft.title', actionbar: '💣 TNT de {user}', color: '#ff5555' },
        ],
      },
      mob('zombie', 'ZOMBIE', '#65a30d', 'zombie'),
      mob('creeper', 'CREEPER', '#16a34a', 'creeper'),
      mob('esqueleto', 'ESQUELETO', '#a3a3a3', 'skeleton'),
      mob('arana', 'ARAÑAS', '#7c3aed', 'spider', 3),
      mob('horda', 'HORDA', '#84cc16', 'zombie', 8),
      mob('wither', 'WITHER', '#111827', 'wither'),
      {
        id: 'comida',
        name: 'COMIDA',
        color: '#f59e0b',
        alignment: 'good',
        steps: [
          { type: 'minecraft.give', item: 'cooked_beef', count: 16 },
          { type: 'minecraft.title', actionbar: '🍖 {user} te dio comida', color: '#55ff55' },
        ],
      },
      {
        id: 'totem',
        name: 'TÓTEM',
        color: '#eab308',
        alignment: 'good',
        steps: [
          { type: 'minecraft.give', item: 'totem_of_undying', count: 1 },
          { type: 'minecraft.title', title: 'TÓTEM', subtitle: 'regalo de {user}', color: '#ffd700' },
        ],
      },
      {
        id: 'manzana',
        name: 'MANZANA',
        color: '#facc15',
        alignment: 'good',
        steps: [
          { type: 'minecraft.give', item: 'golden_apple', count: 2 },
          { type: 'minecraft.effect', effect: 'regeneration', seconds: 10, amplifier: 1 },
        ],
      },
      {
        id: 'apocalipsis',
        name: 'APOCALIPSIS',
        color: '#7f1d1d',
        alignment: 'bad',
        steps: [
          { type: 'minecraft.title', title: '☠ APOCALIPSIS ☠', subtitle: 'cortesía de {user}', color: '#ff0000' },
          { type: 'minecraft.summon', entity: 'creeper', count: 6, nameTag: true, radius: 8 },
          { type: 'minecraft.summon', entity: 'zombie', count: 10, nameTag: true, radius: 8 },
          { type: 'minecraft.command', commands: ['execute at {player} run summon lightning_bolt ~5 ~ ~5', 'execute at {player} run summon lightning_bolt ~-5 ~ ~-5'] },
        ],
      },
    ],
    events: [
      { id: 'ev-follow', trigger: { type: 'follow', oncePerUser: true }, actionIds: ['warden'] },
      { id: 'ev-likes-10', trigger: { type: 'likes', every: 10 }, actionIds: ['zombie'] },
      { id: 'ev-likes-30', trigger: { type: 'likes', every: 30 }, actionIds: ['trueno'] },
      { id: 'ev-likes-50', trigger: { type: 'likes', every: 50 }, actionIds: ['tnt'] },
      { id: 'ev-sala', trigger: { type: 'room_likes', goal: 5000, step: 5000 }, actionIds: ['horda'] },
      { id: 'ev-tiktok', trigger: { type: 'gift', gifts: [{ name: 'TikTok', diamonds: 1 }] }, actionIds: ['creeper'] },
      { id: 'ev-rose', trigger: { type: 'gift', gifts: [{ name: 'Rose', diamonds: 1 }] }, actionIds: ['trueno'] },
      { id: 'ev-gg', trigger: { type: 'gift', gifts: [{ name: 'GG', diamonds: 1 }] }, actionIds: ['zombie'] },
      { id: 'ev-finger', trigger: { type: 'gift', gifts: [{ name: 'Finger Heart', diamonds: 5 }] }, actionIds: ['esqueleto'] },
      { id: 'ev-perfume', trigger: { type: 'gift', gifts: [{ name: 'Perfume', diamonds: 20 }] }, actionIds: ['arana'] },
      { id: 'ev-donut', trigger: { type: 'gift', gifts: [{ name: 'Doughnut', diamonds: 30 }] }, actionIds: ['comida'] },
      { id: 'ev-share', trigger: { type: 'share' }, actionIds: ['manzana'], cooldown: { perUserMs: 60000 } },
      { id: 'ev-hearts', trigger: { type: 'gift', gifts: [{ name: 'Hand Hearts', diamonds: 100 }] }, actionIds: ['totem'] },
      { id: 'ev-galaxy', trigger: { type: 'gift', gifts: [{ name: 'Galaxy', diamonds: 1000 }] }, actionIds: ['wither'] },
      { id: 'ev-grande', trigger: { type: 'diamonds', min: 5000 }, actionIds: ['apocalipsis'] },
    ],
    kit: {
      enabled: false,
      giveOnRespawn: true,
      clearBefore: true,
      armor: {
        head: { item: 'netherite_helmet', unbreakable: true, enchantments: { protection: 4 } },
        chest: { item: 'netherite_chestplate', unbreakable: true, enchantments: { protection: 4 } },
        legs: { item: 'netherite_leggings', unbreakable: true, enchantments: { protection: 4 } },
        feet: { item: 'netherite_boots', unbreakable: true, enchantments: { protection: 4, feather_falling: 4 } },
        offhand: { item: 'totem_of_undying', count: 1 },
      },
      hotbar: [
        { item: 'netherite_sword', unbreakable: true, enchantments: { sharpness: 5 } },
        { item: 'netherite_pickaxe', unbreakable: true, enchantments: { efficiency: 5 } },
        { item: 'bow', unbreakable: true, enchantments: { power: 5, infinity: 1 } },
        { item: 'golden_apple', count: 64 },
        { item: 'cooked_beef', count: 64 },
        { item: 'water_bucket' },
        { item: 'oak_log', count: 64 },
        { item: 'ender_pearl', count: 16 },
        null,
      ],
      inventory: [{ item: 'arrow', count: 64 }],
      nightVision: true,
      jumpBoost: 0,
    },
  }
  return [ProfileSchema.parse(supervivencia)]
}
