/** Las 12 habilidades cinemáticas del plugin LiveArena (ids de /habilidad y de /la efecto cine_<id>). */
export interface CineAbility {
  id: string
  name: string
  color: string
  icon: string
  seconds: number
  desc: string
  model?: string
}

export const CINE_ABILITIES: CineAbility[] = [
  { id: 'escudo', name: 'Escudo de energía', color: '#5ce1ff', icon: '🛡️', seconds: 60, desc: 'Cúpula de paneles hexagonales con vida propia (50 ❤ por defecto): absorbe golpes, cambia de color y se rompe en pedazos.', model: 'escudo' },
  { id: 'onda_repulsion', name: 'Onda de repulsión', color: '#e8f4ff', icon: '💥', seconds: 4, desc: 'Anillo de fuerza que barre el terreno y lanza todo por los aires.' },
  { id: 'corona_espadas', name: 'Corona de espadas', color: '#9fe8ff', icon: '🗡️', seconds: 7, desc: 'Doce espadas de Minecraft (madera, piedra, hierro, oro, diamante y netherita) forman una corona y se disparan.' },
  { id: 'super_rayo', name: 'Súper rayo', color: '#9fdcff', icon: '⚡', seconds: 5, desc: 'El cielo se oscurece y cae un relámpago colosal y ramificado.' },
  { id: 'trueno_explosion', name: 'Trueno + explosión', color: '#ffb347', icon: '🌩️', seconds: 7, desc: 'Tres rayos cercan al jugador, cae el rayo central y todo estalla.' },
  { id: 'carrusel_creepers', name: 'Carrusel de creepers', color: '#58ff7a', icon: '🎠', seconds: 10, desc: 'Ocho creepers cargados por rayos giran como un tiovivo y se lanzan con explosiones enormes y un gran final.' },
  { id: 'ojo_vacio', name: 'Ojo del vacío', color: '#b15cff', icon: '👁️', seconds: 13, desc: 'Un ojo colosal con párpados y tentáculos se abre en el cielo: todo levita y luego es aplastado.', model: 'ojo_vacio' },
  { id: 'agujero_negro', name: 'Agujero negro', color: '#ff8a1a', icon: '🕳️', seconds: 15, desc: 'Un agujero negro con disco de acreción arranca el terreno en espiral, lo traga todo y colapsa.', model: 'agujero_negro' },
  { id: 'juicio_arcano', name: 'Juicio arcano', color: '#ffd34d', icon: '🔯', seconds: 13, desc: 'Círculos arcanos animados en el cielo desatan una lluvia de rayos y un pilar final.', model: 'circulo_arcano' },
  { id: 'esfera_energia', name: 'Esfera de energía', color: '#7fd4ff', icon: '🔵', seconds: 16, desc: 'Un guerrero con aura reúne la energía de todo lo cercano en una esfera gigante y la lanza.', model: 'guerrero' },
  { id: 'meteorito', name: 'Meteorito', color: '#ff6a1a', icon: '☄️', seconds: 18, desc: 'La cámara sube al espacio, una roca incandescente entra y deja un cráter enorme.', model: 'meteorito' },
  { id: 'mil_cortes', name: 'Mil cortes', color: '#ff3b3b', icon: '⚔️', seconds: 15, desc: 'El cielo se vuelve carmesí, surge un santuario maldito y mil cortes rebanan todo hasta el tajo final.', model: 'santuario' },
]
