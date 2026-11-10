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

/** Perfil «LiveArena Épico»: efectos espectaculares del plugin propio para regalos grandes. */
export function laEpicProfile(): Profile {
  const fn = (id: string, name: string, color: string, commands: string[], alignment: 'good' | 'bad' = 'bad'): ActionInput => ({
    id, name, color, alignment,
    steps: commands.map((c) => ({ type: 'minecraft.command' as const, commands: [c], mode: 'all' as const })),
  })
  const fxc = (efecto: string, extra = '') => `la efecto ${efecto} {player} {nickname}${extra ? ` ${extra}` : ''}`
  const gift = (id: string, name: string, diamonds: number, action: string) => ({ id, trigger: { type: 'gift' as const, gifts: [{ name, diamonds }] }, actionIds: [action] })
  return ProfileSchema.parse({
    id: 'la-epico',
    name: 'LiveArena Épico',
    mode: 'supervivencia',
    actions: [
      fn('ep-creeper', 'CREEPER', '#22c55e', [fxc('creeper')]),
      fn('ep-telarana', 'TELARAÑA', '#e5e7eb', [fxc('telarana')]),
      fn('ep-escudo', 'ESCUDO', '#34e0a1', [fxc('escudo_energia', '15')], 'good'),
      fn('ep-totem', 'TÓTEM APILABLE', '#ffcc33', ['la totem add {player} {gift.count} {nickname}'], 'good'),
      fn('ep-onda', 'ONDA DE REPULSIÓN', '#9be7ff', [fxc('onda_repulsion')]),
      fn('ep-corona', 'CORONA DE ESPADAS', '#e5e7eb', [fxc('corona_espadas', '8')]),
      fn('ep-rayo', 'SÚPER RAYO', '#5ef2ff', [fxc('super_rayo', '5')]),
      fn('ep-trueno', 'TRUENO + EXPLOSIÓN', '#ffe066', [fxc('trueno_explosion', '4')]),
      fn('ep-parca', 'LA PARCA', '#9ca3af', [fxc('parca')]),
      fn('ep-carrusel', 'CARRUSEL DE CREEPERS', '#22c55e', [fxc('carrusel_creepers')]),
      fn('ep-ojo', 'OJO DEL VACÍO', '#b15cff', [fxc('ojo_vacio', '6')]),
      fn('ep-agujero', 'AGUJERO NEGRO', '#9b59ff', [fxc('agujero_negro', '8')]),
      fn('ep-arcano', 'JUICIO ARCANO', '#ff7b00', [fxc('juicio_arcano', '6')]),
      fn('ep-dragones', 'DRAGONES', '#7c3aed', [fxc('dragones', '6')]),
      fn('ep-akaza', 'AKAZA', '#3fa9ff', [fxc('akaza', '8')]),
      fn('ep-gojo', 'GOJO · HUECO MORADO', '#b15cff', [fxc('gojo_purpura', '10')]),
      fn('ep-genkidama', 'ESFERA DE ENERGÍA', '#67e8f9', [fxc('genkidama', '8')]),
      fn('ep-mil', 'MIL CORTES', '#ff3b3b', [fxc('mil_cortes', '12')]),
      fn('ep-dominio', 'GOJO · VACÍO INFINITO', '#dca0ff', [fxc('gojo_dominio', '14')]),
      fn('ep-meteorito', 'METEORITO', '#ff6a1a', [fxc('meteorito_gigante', '6')]),
    ],
    events: [
      { id: 'ep-ev-follow', trigger: { type: 'follow', oncePerUser: true }, actionIds: ['ep-escudo'] },
      { id: 'ep-ev-likes', trigger: { type: 'likes', every: 200 }, actionIds: ['ep-creeper'] },
      gift('ep-ev-rose', 'Rose', 1, 'ep-telarana'),
      gift('ep-ev-heartme', 'Heart Me', 1, 'ep-totem'),
      gift('ep-ev-gg', 'GG', 1, 'ep-onda'),
      gift('ep-ev-finger', 'Finger Heart', 5, 'ep-corona'),
      gift('ep-ev-perfume', 'Perfume', 20, 'ep-rayo'),
      gift('ep-ev-donut', 'Doughnut', 30, 'ep-trueno'),
      gift('ep-ev-hearts', 'Hand Hearts', 100, 'ep-parca'),
      gift('ep-ev-confetti', 'Confetti', 100, 'ep-carrusel'),
      gift('ep-ev-sunglasses', 'Sunglasses', 199, 'ep-ojo'),
      gift('ep-ev-corgi', 'Corgi', 299, 'ep-agujero'),
      gift('ep-ev-moneygun', 'Money Gun', 500, 'ep-arcano'),
      gift('ep-ev-galaxy', 'Galaxy', 1000, 'ep-akaza'),
      gift('ep-ev-gol', 'Gol', 999, 'ep-gojo'),
      gift('ep-ev-fireworks', 'Fireworks', 1088, 'ep-genkidama'),
      gift('ep-ev-lion', 'Lion', 29999, 'ep-dominio'),
      { id: 'ep-ev-big', trigger: { type: 'diamonds', min: 5000 }, actionIds: ['ep-meteorito'] },
      { id: 'ep-ev-room', trigger: { type: 'room_likes', goal: 10000, step: 10000 }, actionIds: ['ep-mil'] },
    ],
  })
}

/**
 * Perfil del minijuego Base Defense: cada regalo manda monstruos por el carril, cura la base o invoca un jefe.
 * Los comandos /tt* del plugin toman el nombre del espectador al final ({user}, con espacios y emojis).
 */
export function baseDefenseProfile(): Profile {
  const fn = (id: string, name: string, color: string, commands: string[], alignment: 'good' | 'bad' = 'bad'): ActionInput => ({
    id,
    name,
    color,
    alignment,
    steps: [{ type: 'minecraft.command' as const, commands, mode: 'all' as const }],
  })
  const gift = (id: string, name: string, diamonds: number, action: string) => ({ id, trigger: { type: 'gift' as const, gifts: [{ name, diamonds }] }, actionIds: [action] })
  return ProfileSchema.parse({
    id: 'base-defense',
    name: 'Base Defense',
    mode: 'basedefense',
    actions: [
      fn('bd-zombies', 'ZOMBIS', '#65a30d', ['ttspawn zombie 2 {user}']),
      fn('bd-esqueleto', 'ESQUELETO', '#a3a3a3', ['ttspawn skeleton 1 {user}']),
      fn('bd-aranas', 'ARAÑAS', '#7c3aed', ['ttspawn spider 2 {user}']),
      fn('bd-piglins', 'PIGLINS', '#f59e0b', ['ttspawn piglin 2 {user}']),
      fn('bd-horda', 'HORDA', '#84cc16', ['ttspawn horda 10 {user}']),
      fn('bd-esq-wither', 'ESQ. WITHER', '#3f3f46', ['ttspawn wither_skeleton 3 {user}']),
      fn('bd-horda-grande', 'HORDA GRANDE', '#ca8a04', ['ttspawn horda 30 {user}']),
      fn('bd-brutos', 'PIGLINS BRUTOS', '#b45309', ['ttspawn piglin_brute 3 {user}']),
      fn('bd-curar', 'CURAR BASE', '#22c55e', ['ttheal 100 {user}'], 'good'),
      fn('bd-curar-poco', 'REPARAR', '#4ade80', ['ttheal 25 {user}'], 'good'),
      fn('bd-suministro', 'SUMINISTROS', '#eab308', ['ttsuministro {user}'], 'good'),
      fn('bd-chat-zombi', 'ZOMBI (chat)', '#4d7c0f', ['ttspawn zombie 1 {user}']),
      fn('bd-chat-ayuda', 'AYUDA (chat)', '#16a34a', ['ttheal 10 {user}'], 'good'),
      fn('bd-misil', 'MISIL ALIADO', '#38bdf8', ['ttaliado misil {user}'], 'good'),
      fn('bd-bombardeo', 'BOMBARDEO', '#0ea5e9', ['ttaliado bombardeo {user}'], 'good'),
      fn('bd-rayo', 'RAYO ORBITAL', '#67e8f9', ['ttaliado rayo {user}'], 'good'),
      fn('bd-wither', 'WITHER', '#111827', ['ttboss wither {user}']),
      fn('bd-warden', 'WARDEN', '#0e7490', ['ttboss warden {user}']),
      fn('bd-dragon', 'DRAGÓN', '#7e22ce', ['ttboss dragon {user}']),
    ],
    events: [
      gift('bd-ev-rose', 'Rose', 1, 'bd-zombies'),
      gift('bd-ev-tiktok', 'TikTok', 1, 'bd-esqueleto'),
      gift('bd-ev-gg', 'GG', 1, 'bd-aranas'),
      gift('bd-ev-finger', 'Finger Heart', 5, 'bd-piglins'),
      gift('bd-ev-perfume', 'Perfume', 20, 'bd-horda'),
      gift('bd-ev-donut', 'Doughnut', 30, 'bd-curar'),
      gift('bd-ev-hearts', 'Hand Hearts', 100, 'bd-horda-grande'),
      gift('bd-ev-confetti', 'Confetti', 100, 'bd-esq-wither'),
      gift('bd-ev-corgi', 'Corgi', 299, 'bd-brutos'),
      gift('bd-ev-cap', 'Cap', 99, 'bd-misil'),
      gift('bd-ev-sunglasses', 'Sunglasses', 199, 'bd-bombardeo'),
      gift('bd-ev-moneygun', 'Money Gun', 500, 'bd-suministro'),
      gift('bd-ev-swan', 'Swan', 699, 'bd-rayo'),
      gift('bd-ev-galaxy', 'Galaxy', 1000, 'bd-wither'),
      { id: 'bd-ev-big', trigger: { type: 'diamonds', min: 3000, max: 4999 }, actionIds: ['bd-warden'] },
      { id: 'bd-ev-huge', trigger: { type: 'diamonds', min: 5000 }, actionIds: ['bd-dragon'] },
      { id: 'bd-ev-follow', trigger: { type: 'follow', oncePerUser: true }, actionIds: ['bd-curar-poco'] },
      { id: 'bd-ev-chat-zombi', trigger: { type: 'chat', contains: 'zombie' }, actionIds: ['bd-chat-zombi'], cooldown: { perUserMs: 30000 } },
      { id: 'bd-ev-chat-ayuda', trigger: { type: 'chat', contains: 'ayuda' }, actionIds: ['bd-chat-ayuda'], cooldown: { perUserMs: 60000 } },
      { id: 'bd-ev-share', trigger: { type: 'share' }, actionIds: ['bd-esqueleto'], cooldown: { perUserMs: 30000 } },
    ],
    notes: 'Bando aliado (ayudan): curar, suministros, misil, bombardeo y rayo orbital. Bando enemigo: mobs, hordas y jefes. La meta de likes (jefe Wither) la lleva el propio plugin: la app le envía el total de likes con /ttlikes. «horda» = mezcla de los mobs de la fase actual.',
  })
}
