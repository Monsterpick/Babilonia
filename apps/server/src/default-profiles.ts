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

/**
 * Perfil «Minecraft Survival Épico»: los efectos survival del plugin propio (como «LiveArena Survival») para los
 * regalos pequeños y todas las cinemáticas (mod LiveArena Cinemáticas) para los grandes. Sustituye al antiguo
 * «LiveArena Épico», que usaba las primeras versiones de los efectos épicos.
 */
export function survivalEpicProfile(): Profile {
  const fn = (id: string, name: string, color: string, commands: string[], alignment: 'good' | 'bad' = 'bad'): ActionInput => ({
    id, name, color, alignment,
    steps: commands.map((c) => ({ type: 'minecraft.command' as const, commands: [c], mode: 'all' as const })),
  })
  const fx = (efecto: string, extra = '') => `la efecto ${efecto} {player} {nickname}${extra ? ` ${extra}` : ''}`
  const cine = (id: string) => fx(`cine_${id}`)
  const gift = (id: string, name: string, diamonds: number, action: string) => ({ id, trigger: { type: 'gift' as const, gifts: [{ name, diamonds }] }, actionIds: [action] })
  return ProfileSchema.parse({
    id: 'mc-survival-epico',
    name: 'Minecraft Survival Épico',
    mode: 'supervivencia',
    actions: [
      // Survival (plugin LiveArena)
      fn('se-zombie', 'ZOMBIE', '#65a30d', [fx('zombie', 'hierro')]),
      fn('se-creeper', 'CREEPER', '#22c55e', [fx('creeper')]),
      fn('se-skeleton', 'ESQUELETO', '#d4d4d8', [fx('esqueleto')]),
      fn('se-spider', 'ARAÑA', '#7c3aed', [fx('arana')]),
      fn('se-witch', 'BRUJA', '#a21caf', [fx('bruja')]),
      fn('se-tnt', 'TNT', '#dc2626', [fx('tnt', '60 3')]),
      fn('se-food', 'COMIDA', '#f59e0b', [fx('comida')], 'good'),
      fn('se-totem', 'TÓTEM APILABLE', '#ffcc33', ['la totem add {player} {gift.count} {nickname}'], 'good'),
      fn('se-web', 'TELARAÑA', '#e5e7eb', [fx('telarana')]),
      fn('se-freeze', 'CONGELADO', '#a5f3fc', [fx('congelar', '8')]),
      fn('se-ravager', 'DEVASTADOR', '#b45309', [fx('ravager')]),
      fn('se-chest', 'COFRE ÉPICO', '#fde047', [fx('cofre_epico')], 'good'),
      fn('se-boss', 'JEFE', '#dc2626', [fx('jefe')]),
      fn('se-apple', 'MANZANA DORADA', '#ffd166', [fx('manzana')], 'good'),
      fn('se-dog', 'PERRO', '#d6d3d1', [fx('perro')], 'good'),
      fn('se-horde', 'HORDA', '#991b1b', [fx('horda')]),
      // Cinemáticas (mod LiveArena Cinemáticas)
      fn('se-escudo', 'ESCUDO DE ENERGÍA', '#5ce1ff', [cine('escudo')], 'good'),
      fn('se-onda', 'ONDA DE REPULSIÓN', '#e8f4ff', [cine('onda_repulsion')]),
      fn('se-corona', 'CORONA DE ESPADAS', '#9fe8ff', [cine('corona_espadas')]),
      fn('se-rayo', 'SÚPER RAYO', '#9fdcff', [cine('super_rayo')]),
      fn('se-trueno', 'TRUENO + EXPLOSIÓN', '#ffb347', [cine('trueno_explosion')]),
      fn('se-carrusel', 'CARRUSEL DE CREEPERS', '#58ff7a', [cine('carrusel_creepers')]),
      fn('se-ojo', 'OJO DEL VACÍO', '#b15cff', [cine('ojo_vacio')]),
      fn('se-agujero', 'AGUJERO NEGRO', '#ff8a1a', [cine('agujero_negro')]),
      fn('se-igneo', 'JUICIO ÍGNEO', '#ff6a1a', [cine('juicio_arcano')]),
      fn('se-sangre', 'SANGRE PERFORANTE', '#c0101c', [cine('sangre_perforante')]),
      fn('se-akaza', 'AGUJA DE BRÚJULA', '#7fd8ff', [cine('akaza')]),
      fn('se-mil', 'MIL CORTES', '#ff3b3b', [cine('mil_cortes')]),
      fn('se-meteorito', 'METEORITO', '#ff6a1a', [cine('meteorito')]),
      fn('se-orbital', 'ATAQUE ORBITAL', '#ff1a2a', [cine('ataque_orbital')]),
      fn('se-purpura', 'VACÍO PÚRPURA', '#9b30ff', [cine('vacio_purpura')]),
      fn('se-genkidama', 'GENKIDAMA', '#8fd3ff', [cine('genkidama')]),
    ],
    events: [
      { id: 'se-ev-follow', trigger: { type: 'follow', oncePerUser: true }, actionIds: ['se-dog'] },
      { id: 'se-ev-likes', trigger: { type: 'likes', every: 150 }, actionIds: ['se-zombie'] },
      { id: 'se-ev-share', trigger: { type: 'share' }, actionIds: ['se-apple'], cooldown: { perUserMs: 60000 } },
      gift('se-ev-rose', 'Rose', 1, 'se-creeper'),
      gift('se-ev-tiktok', 'TikTok', 1, 'se-skeleton'),
      gift('se-ev-gg', 'GG', 1, 'se-spider'),
      gift('se-ev-heartme', 'Heart Me', 1, 'se-totem'),
      gift('se-ev-finger', 'Finger Heart', 5, 'se-witch'),
      gift('se-ev-perfume', 'Perfume', 20, 'se-tnt'),
      gift('se-ev-donut', 'Doughnut', 30, 'se-food'),
      gift('se-ev-hearts', 'Hand Hearts', 100, 'se-escudo'),
      gift('se-ev-confetti', 'Confetti', 100, 'se-onda'),
      gift('se-ev-sunglasses', 'Sunglasses', 199, 'se-corona'),
      gift('se-ev-corgi', 'Corgi', 299, 'se-rayo'),
      gift('se-ev-moneygun', 'Money Gun', 500, 'se-trueno'),
      gift('se-ev-galaxy', 'Galaxy', 1000, 'se-igneo'),
      gift('se-ev-gol', 'Gol', 999, 'se-sangre'),
      gift('se-ev-fireworks', 'Fireworks', 1088, 'se-akaza'),
      gift('se-ev-lion', 'Lion', 29999, 'se-purpura'),
      { id: 'se-ev-big', trigger: { type: 'diamonds', min: 5000 }, actionIds: ['se-orbital'] },
      { id: 'se-ev-room', trigger: { type: 'room_likes', goal: 10000, step: 10000 }, actionIds: ['se-horde'] },
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

/**
 * Perfil del minijuego Parkour LIVE: los regalos suben o bajan de nivel al streamer, le empujan o le ponen trampas
 * (y también le ayudan). /ttpk <efecto> [n] {user}.
 */
export function parkourProfile(): Profile {
  const fn = (id: string, name: string, color: string, commands: string[], alignment: 'good' | 'bad' = 'bad'): ActionInput => ({
    id,
    name,
    color,
    alignment,
    steps: [{ type: 'minecraft.command' as const, commands, mode: 'all' as const }],
  })
  const gift = (id: string, name: string, diamonds: number, action: string) => ({ id, trigger: { type: 'gift' as const, gifts: [{ name, diamonds }] }, actionIds: [action] })
  return ProfileSchema.parse({
    id: 'parkour',
    name: 'Parkour LIVE',
    mode: 'parkour',
    actions: [
      fn('pk-empujar', 'EMPUJAR', '#f59e0b', ['ttpk empujar {user}']),
      fn('pk-subir1', 'SUBIR 1 NIVEL', '#22c55e', ['ttpk subir 1 {user}'], 'good'),
      fn('pk-bajar1', 'BAJAR 1 NIVEL', '#ef4444', ['ttpk bajar 1 {user}']),
      fn('pk-subir10', 'SUBIR 10 NIVELES', '#16a34a', ['ttpk subir 10 {user}'], 'good'),
      fn('pk-bajar10', 'BAJAR 10 NIVELES', '#b91c1c', ['ttpk bajar 10 {user}']),
      fn('pk-viento', 'VIENTO', '#38bdf8', ['ttpk viento {user}']),
      fn('pk-niebla', 'APAGAR LUCES', '#334155', ['ttpk niebla {user}']),
      fn('pk-hielo', 'CAMINO DE HIELO', '#7dd3fc', ['ttpk hielo {user}']),
      fn('pk-fantasma', 'BLOQUES FANTASMA', '#a1a1aa', ['ttpk fantasma {user}']),
      fn('pk-terremoto', 'TERREMOTO', '#a16207', ['ttpk terremoto {user}']),
      fn('pk-lento', 'LENTITUD', '#6366f1', ['ttpk lento {user}']),
      fn('pk-supersalto', 'SUPERSALTO', '#4ade80', ['ttpk supersalto {user}'], 'good'),
      fn('pk-escudo', 'ESCUDO ANTICAÍDA', '#f472b6', ['ttpk escudo {user}'], 'good'),
      fn('pk-guia', 'MARCAR CAMINO', '#facc15', ['ttpk guia {user}'], 'good'),
      fn('pk-puente', 'PUENTE', '#67e8f9', ['ttpk puente {user}'], 'good'),
    ],
    events: [
      gift('pk-ev-rose', 'Rose', 1, 'pk-empujar'),
      gift('pk-ev-tiktok', 'TikTok', 1, 'pk-empujar'),
      gift('pk-ev-gg', 'GG', 1, 'pk-viento'),
      gift('pk-ev-finger', 'Finger Heart', 5, 'pk-subir1'),
      gift('pk-ev-heartme', 'Heart Me', 1, 'pk-guia'),
      gift('pk-ev-perfume', 'Perfume', 20, 'pk-bajar1'),
      gift('pk-ev-donut', 'Doughnut', 30, 'pk-niebla'),
      gift('pk-ev-cap', 'Cap', 99, 'pk-supersalto'),
      gift('pk-ev-hearts', 'Hand Hearts', 100, 'pk-hielo'),
      gift('pk-ev-confetti', 'Confetti', 100, 'pk-fantasma'),
      gift('pk-ev-sunglasses', 'Sunglasses', 199, 'pk-escudo'),
      gift('pk-ev-corgi', 'Corgi', 299, 'pk-terremoto'),
      gift('pk-ev-moneygun', 'Money Gun', 500, 'pk-subir10'),
      gift('pk-ev-swan', 'Swan', 699, 'pk-puente'),
      gift('pk-ev-galaxy', 'Galaxy', 1000, 'pk-bajar10'),
      { id: 'pk-ev-follow', trigger: { type: 'follow', oncePerUser: true }, actionIds: ['pk-guia'] },
      { id: 'pk-ev-share', trigger: { type: 'share' }, actionIds: ['pk-empujar'], cooldown: { perUserMs: 30000 } },
      { id: 'pk-ev-likes', trigger: { type: 'likes', every: 500 }, actionIds: ['pk-empujar'] },
      { id: 'pk-ev-chat-sube', trigger: { type: 'chat', contains: 'sube' }, actionIds: ['pk-supersalto'], cooldown: { perUserMs: 120000 } },
    ],
    notes: 'Ayudas: subir niveles, supersalto, escudo anticaída, marcar camino y puente. Sabotajes: bajar niveles, empujar, viento, apagar luces, hielo, bloques fantasma, terremoto y lentitud. Los efectos van en cola, uno detrás de otro; tras varias caídas seguidas el streamer queda protegido unos segundos.',
  })
}

/**
 * LAST HOUSE (juego web propio): perfil vacío. Mientras se juega, los regalos los interpreta el propio juego y no
 * debe saltar ninguna acción de Minecraft.
 */
export function lastHouseProfile(): Profile {
  return ProfileSchema.parse({ id: 'lasthouse', name: 'LAST HOUSE', mode: 'lasthouse', actions: [], events: [] })
}

/**
 * Perfil del minijuego Dropper LIVE: los regalos le saltan niveles al streamer, le devuelven arriba, le empujan
 * durante la caída o le ayudan (caída lenta, escudo, marcar huecos). /ttdr <efecto> [n] {user}.
 */
export function dropperProfile(): Profile {
  const fn = (id: string, name: string, color: string, commands: string[], alignment: 'good' | 'bad' = 'bad'): ActionInput => ({
    id,
    name,
    color,
    alignment,
    steps: [{ type: 'minecraft.command' as const, commands, mode: 'all' as const }],
  })
  const gift = (id: string, name: string, diamonds: number, action: string) => ({ id, trigger: { type: 'gift' as const, gifts: [{ name, diamonds }] }, actionIds: [action] })
  return ProfileSchema.parse({
    id: 'dropper',
    name: 'Dropper LIVE',
    mode: 'parkour',
    actions: [
      fn('dr-empujar', 'EMPUJAR', '#f59e0b', ['ttdr empujar {user}']),
      fn('dr-viento', 'VIENTO', '#38bdf8', ['ttdr viento {user}']),
      fn('dr-niebla', 'APAGAR LUCES', '#334155', ['ttdr niebla {user}']),
      fn('dr-acelerar', 'ACELERAR CAÍDA', '#ef4444', ['ttdr acelerar {user}']),
      fn('dr-terremoto', 'TERREMOTO', '#a16207', ['ttdr terremoto {user}']),
      fn('dr-reiniciar', 'VOLVER ARRIBA', '#b91c1c', ['ttdr reiniciar {user}']),
      fn('dr-bajar1', 'ATRÁS 1 NIVEL', '#dc2626', ['ttdr bajar 1 {user}']),
      fn('dr-bajar5', 'ATRÁS 5 NIVELES', '#991b1b', ['ttdr bajar 5 {user}']),
      fn('dr-subir1', 'SALTAR 1 NIVEL', '#22c55e', ['ttdr subir 1 {user}'], 'good'),
      fn('dr-subir5', 'SALTAR 5 NIVELES', '#16a34a', ['ttdr subir 5 {user}'], 'good'),
      fn('dr-lento', 'CAÍDA LENTA', '#6366f1', ['ttdr lento {user}'], 'good'),
      fn('dr-escudo', 'ESCUDO ANTICHOQUE', '#f472b6', ['ttdr escudo {user}'], 'good'),
      fn('dr-guia', 'MARCAR HUECOS', '#facc15', ['ttdr guia {user}'], 'good'),
    ],
    events: [
      gift('dr-ev-rose', 'Rose', 1, 'dr-empujar'),
      gift('dr-ev-tiktok', 'TikTok', 1, 'dr-empujar'),
      gift('dr-ev-gg', 'GG', 1, 'dr-viento'),
      gift('dr-ev-heartme', 'Heart Me', 1, 'dr-guia'),
      gift('dr-ev-finger', 'Finger Heart', 5, 'dr-lento'),
      gift('dr-ev-perfume', 'Perfume', 20, 'dr-reiniciar'),
      gift('dr-ev-donut', 'Doughnut', 30, 'dr-niebla'),
      gift('dr-ev-cap', 'Cap', 99, 'dr-escudo'),
      gift('dr-ev-hearts', 'Hand Hearts', 100, 'dr-terremoto'),
      gift('dr-ev-confetti', 'Confetti', 100, 'dr-acelerar'),
      gift('dr-ev-sunglasses', 'Sunglasses', 199, 'dr-subir1'),
      gift('dr-ev-corgi', 'Corgi', 299, 'dr-bajar1'),
      gift('dr-ev-moneygun', 'Money Gun', 500, 'dr-subir5'),
      gift('dr-ev-galaxy', 'Galaxy', 1000, 'dr-bajar5'),
      { id: 'dr-ev-likes', trigger: { type: 'likes', every: 200 }, actionIds: ['dr-empujar'] },
      { id: 'dr-ev-follow', trigger: { type: 'follow', oncePerUser: true }, actionIds: ['dr-guia'] },
      { id: 'dr-ev-share', trigger: { type: 'share' }, actionIds: ['dr-lento'], cooldown: { perUserMs: 60000 } },
    ],
    notes: 'Ayudas: saltar niveles, caída lenta, escudo antichoque y marcar huecos. Sabotajes: empujar, viento, apagar luces, acelerar, terremoto, volver arriba y atrás niveles.',
  })
}

/**
 * Perfil del minijuego No Salpiques: el público te ayuda a saltar (piedras, bengalas, supersalto, puente, escudo,
 * dormir a la criatura) o te empuja al agua (empujar, despertar, hundir, apagar luces, resbalar, enfurecer). /ttns.
 */
export function noSalpiquesProfile(): Profile {
  const fn = (id: string, name: string, color: string, commands: string[], alignment: 'good' | 'bad' = 'bad'): ActionInput => ({
    id,
    name,
    color,
    alignment,
    steps: [{ type: 'minecraft.command' as const, commands, mode: 'all' as const }],
  })
  const gift = (id: string, name: string, diamonds: number, action: string) => ({ id, trigger: { type: 'gift' as const, gifts: [{ name, diamonds }] }, actionIds: [action] })
  return ProfileSchema.parse({
    id: 'nosalpiques',
    name: 'No Salpiques',
    mode: 'parkour',
    actions: [
      fn('ns-empujar', 'EMPUJAR AL AGUA', '#f59e0b', ['ttns empujar {user}']),
      fn('ns-despertar', 'DESPERTAR CRIATURA', '#7f1d1d', ['ttns despertar {user}']),
      fn('ns-hundir', 'HUNDIR PLATAFORMA', '#ef4444', ['ttns hundir {user}']),
      fn('ns-apagar', 'APAGAR LUCES', '#334155', ['ttns apagar {user}']),
      fn('ns-resbalar', 'SUELO RESBALADIZO', '#7dd3fc', ['ttns resbalar {user}']),
      fn('ns-rapido', 'ENFURECER CRIATURA', '#b91c1c', ['ttns rapido {user}']),
      fn('ns-piedra', 'PIEDRAS', '#9ca3af', ['ttns piedra 2 {user}'], 'good'),
      fn('ns-bengala', 'BENGALA', '#f97316', ['ttns bengala 1 {user}'], 'good'),
      fn('ns-supersalto', 'SUPERSALTO', '#4ade80', ['ttns supersalto {user}'], 'good'),
      fn('ns-puente', 'PUENTE', '#e5e7eb', ['ttns puente {user}'], 'good'),
      fn('ns-escudo', 'ESCUDO ANTISALPICÓN', '#f472b6', ['ttns escudo {user}'], 'good'),
      fn('ns-dormir', 'DORMIR CRIATURA', '#6366f1', ['ttns dormir {user}'], 'good'),
    ],
    events: [
      gift('ns-ev-rose', 'Rose', 1, 'ns-empujar'),
      gift('ns-ev-tiktok', 'TikTok', 1, 'ns-piedra'),
      gift('ns-ev-gg', 'GG', 1, 'ns-resbalar'),
      gift('ns-ev-heartme', 'Heart Me', 1, 'ns-supersalto'),
      gift('ns-ev-finger', 'Finger Heart', 5, 'ns-bengala'),
      gift('ns-ev-perfume', 'Perfume', 20, 'ns-hundir'),
      gift('ns-ev-donut', 'Doughnut', 30, 'ns-apagar'),
      gift('ns-ev-cap', 'Cap', 99, 'ns-puente'),
      gift('ns-ev-hearts', 'Hand Hearts', 100, 'ns-escudo'),
      gift('ns-ev-confetti', 'Confetti', 100, 'ns-rapido'),
      gift('ns-ev-sunglasses', 'Sunglasses', 199, 'ns-dormir'),
      gift('ns-ev-corgi', 'Corgi', 299, 'ns-despertar'),
      { id: 'ns-ev-likes', trigger: { type: 'likes', every: 200 }, actionIds: ['ns-empujar'] },
      { id: 'ns-ev-follow', trigger: { type: 'follow', oncePerUser: true }, actionIds: ['ns-piedra'] },
      { id: 'ns-ev-share', trigger: { type: 'share' }, actionIds: ['ns-bengala'], cooldown: { perUserMs: 60000 } },
    ],
    notes: 'Ayudas: piedras (distraen), bengalas (ciegan), supersalto, puente, escudo y dormir a la criatura. Sabotajes: empujar al agua, despertar o enfurecer a la criatura, hundir plataforma, apagar luces y suelo resbaladizo.',
  })
}
