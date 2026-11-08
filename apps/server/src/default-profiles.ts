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
  return [ProfileSchema.parse(supervivencia), s2eProfile()]
}

/** Perfil para el plugin s2e-survival (comando /survival). {nickname} = nombre del espectador sobre el mob. */
export function s2eProfile(): Profile {
  const fn = (id: string, name: string, color: string, commands: string[], alignment: 'good' | 'bad' = 'bad'): ActionInput => ({
    id,
    name,
    color,
    alignment,
    steps: commands.map((c) => ({ type: 'minecraft.command' as const, commands: [c], mode: 'all' as const })),
  })
  const gift = (id: string, name: string, diamonds: number, action: string) => ({ id, trigger: { type: 'gift' as const, gifts: [{ name, diamonds }] }, actionIds: [action] })
  return ProfileSchema.parse({
    id: 's2e-survival',
    name: 's2e Survival',
    mode: 'supervivencia',
    actions: [
      fn('s2e-zombie', 'ZOMBIE', '#65a30d', ['survival zombie null {nickname}']),
      fn('s2e-creeper', 'CREEPER', '#16a34a', ['survival creeper {nickname}']),
      fn('s2e-skeleton', 'ESQUELETO', '#a3a3a3', ['survival skeleton {nickname}']),
      fn('s2e-spider', 'ARAÑA', '#7c3aed', ['survival spider {nickname}']),
      fn('s2e-witch', 'BRUJA', '#a21caf', ['survival witch {nickname}']),
      fn('s2e-tnt', 'TNT', '#dc2626', ['survival tnt 60 4 3 {nickname}']),
      fn('s2e-food', 'COMIDA', '#f59e0b', ['survival random_food {nickname}'], 'good'),
      fn('s2e-totem', 'TÓTEM', '#eab308', ['survival totem {nickname}'], 'good'),
      fn('s2e-trap', 'TRAMPA', '#e5e7eb', ['survival trap {nickname}']),
      fn('s2e-ravager', 'RAVAGER', '#78350f', ['survival ravager {nickname}']),
      fn('s2e-chest', 'COFRE ÉPICO', '#facc15', ['survival chest_super'], 'good'),
      fn('s2e-boss', 'JEFE', '#7f1d1d', ['survival random_boss {nickname}']),
      fn('s2e-meteors', 'METEORITOS', '#ea580c', ['survival meteors 10 {nickname}']),
      fn('s2e-apple', 'MANZANA', '#fbbf24', ['survival apple_enchanted {nickname}'], 'good'),
      fn('s2e-dog', 'PERRO', '#d6d3d1', ['survival dog'], 'good'),
      fn('s2e-raid', 'RAID', '#991b1b', ['survival raid {nickname}']),
    ],
    events: [
      { id: 's2e-ev-follow', trigger: { type: 'follow', oncePerUser: true }, actionIds: ['s2e-dog'] },
      { id: 's2e-ev-likes', trigger: { type: 'likes', every: 150 }, actionIds: ['s2e-zombie'] },
      gift('s2e-ev-rose', 'Rose', 1, 's2e-creeper'),
      gift('s2e-ev-tiktok', 'TikTok', 1, 's2e-skeleton'),
      gift('s2e-ev-gg', 'GG', 1, 's2e-spider'),
      gift('s2e-ev-finger', 'Finger Heart', 5, 's2e-witch'),
      gift('s2e-ev-perfume', 'Perfume', 20, 's2e-tnt'),
      gift('s2e-ev-donut', 'Doughnut', 30, 's2e-food'),
      gift('s2e-ev-hearts', 'Hand Hearts', 100, 's2e-totem'),
      gift('s2e-ev-confetti', 'Confetti', 100, 's2e-trap'),
      gift('s2e-ev-corgi', 'Corgi', 299, 's2e-ravager'),
      gift('s2e-ev-moneygun', 'Money Gun', 500, 's2e-chest'),
      gift('s2e-ev-galaxy', 'Galaxy', 1000, 's2e-boss'),
      { id: 's2e-ev-big', trigger: { type: 'diamonds', min: 5000 }, actionIds: ['s2e-meteors'] },
      { id: 's2e-ev-share', trigger: { type: 'share' }, actionIds: ['s2e-apple'], cooldown: { perUserMs: 60000 } },
      { id: 's2e-ev-room', trigger: { type: 'room_likes', goal: 10000, step: 10000 }, actionIds: ['s2e-raid'] },
    ],
  })
}

/**
 * Perfil para el plugin propio LiveArena (/la efecto …): efectos survival en español, con
 * el nombre del espectador sobre cada mob, y tótems apilables. Se instala solo con la app.
 */
export function laSurvivalProfile(): Profile {
  const fn = (id: string, name: string, color: string, commands: string[], alignment: 'good' | 'bad' = 'bad'): ActionInput => ({
    id,
    name,
    color,
    alignment,
    steps: commands.map((c) => ({ type: 'minecraft.command' as const, commands: [c], mode: 'all' as const })),
  })
  const fx = (efecto: string, extra = '') => `la efecto ${efecto} {player} {nickname}${extra ? ` ${extra}` : ''}`
  const gift = (id: string, name: string, diamonds: number, action: string) => ({ id, trigger: { type: 'gift' as const, gifts: [{ name, diamonds }] }, actionIds: [action] })
  return ProfileSchema.parse({
    id: 'la-survival',
    name: 'LiveArena Survival',
    mode: 'supervivencia',
    actions: [
      fn('la-zombie', 'ZOMBIE', '#65a30d', [fx('zombie', 'hierro')]),
      fn('la-creeper', 'CREEPER', '#22c55e', [fx('creeper')]),
      fn('la-skeleton', 'ESQUELETO', '#d4d4d8', [fx('esqueleto')]),
      fn('la-spider', 'ARAÑA', '#7c3aed', [fx('arana')]),
      fn('la-witch', 'BRUJA', '#a21caf', [fx('bruja')]),
      fn('la-tnt', 'TNT', '#dc2626', [fx('tnt', '60 3')]),
      fn('la-food', 'COMIDA', '#f59e0b', [fx('comida')], 'good'),
      fn('la-totem', 'TÓTEM APILABLE', '#ffcc33', ['la totem add {player} {gift.count} {nickname}'], 'good'),
      fn('la-web', 'TELARAÑA', '#e5e7eb', [fx('telarana')]),
      fn('la-ravager', 'DEVASTADOR', '#b45309', [fx('ravager')]),
      fn('la-chest', 'COFRE ÉPICO', '#fde047', [fx('cofre_epico')], 'good'),
      fn('la-boss', 'JEFE', '#dc2626', [fx('jefe')]),
      fn('la-meteors', 'METEORITOS', '#fb923c', [fx('meteoritos', '10')]),
      fn('la-apple', 'MANZANA DORADA', '#ffd166', [fx('manzana')], 'good'),
      fn('la-dog', 'PERRO', '#d6d3d1', [fx('perro')], 'good'),
      fn('la-horde', 'HORDA', '#991b1b', [fx('horda')]),
      fn('la-freeze', 'CONGELADO', '#a5f3fc', [fx('congelar', '8')]),
      fn('la-fall', 'CAÍDA LIBRE', '#38bdf8', [fx('caida')]),
    ],
    events: [
      { id: 'la-ev-follow', trigger: { type: 'follow', oncePerUser: true }, actionIds: ['la-dog'] },
      { id: 'la-ev-likes', trigger: { type: 'likes', every: 150 }, actionIds: ['la-zombie'] },
      gift('la-ev-rose', 'Rose', 1, 'la-creeper'),
      gift('la-ev-tiktok', 'TikTok', 1, 'la-skeleton'),
      gift('la-ev-gg', 'GG', 1, 'la-spider'),
      gift('la-ev-heartme', 'Heart Me', 1, 'la-totem'),
      gift('la-ev-finger', 'Finger Heart', 5, 'la-witch'),
      gift('la-ev-perfume', 'Perfume', 20, 'la-tnt'),
      gift('la-ev-donut', 'Doughnut', 30, 'la-food'),
      gift('la-ev-hearts', 'Hand Hearts', 100, 'la-web'),
      gift('la-ev-confetti', 'Confetti', 100, 'la-freeze'),
      gift('la-ev-sunglasses', 'Sunglasses', 199, 'la-fall'),
      gift('la-ev-corgi', 'Corgi', 299, 'la-ravager'),
      gift('la-ev-moneygun', 'Money Gun', 500, 'la-chest'),
      gift('la-ev-galaxy', 'Galaxy', 1000, 'la-boss'),
      { id: 'la-ev-big', trigger: { type: 'diamonds', min: 5000 }, actionIds: ['la-meteors'] },
      { id: 'la-ev-share', trigger: { type: 'share' }, actionIds: ['la-apple'], cooldown: { perUserMs: 60000 } },
      { id: 'la-ev-room', trigger: { type: 'room_likes', goal: 10000, step: 10000 }, actionIds: ['la-horde'] },
    ],
  })
}
