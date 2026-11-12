/** Las habilidades cinemáticas del plugin LiveArena (ids de /habilidad y de /la efecto cine_<id>). */
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
  { id: 'escudo', name: 'Escudo de energía', color: '#5ce1ff', icon: '🛡️', seconds: 60, desc: 'Coraza de paneles hexagonales pegada al cuerpo, con vida propia (50 ❤ por defecto): absorbe golpes, cambia de color y se rompe en pedazos.', model: 'escudo' },
  { id: 'onda_repulsion', name: 'Onda de repulsión', color: '#e8f4ff', icon: '💥', seconds: 4, desc: 'Anillo de fuerza que barre el terreno y lanza todo por los aires.' },
  { id: 'corona_espadas', name: 'Corona de espadas', color: '#9fe8ff', icon: '🗡️', seconds: 7, desc: 'Doce espadas de Minecraft (madera, piedra, hierro, oro, diamante y netherita) forman una corona y se disparan.' },
  { id: 'super_rayo', name: 'Súper rayo', color: '#9fdcff', icon: '⚡', seconds: 5, desc: 'El cielo se oscurece y cae un relámpago colosal y ramificado.' },
  { id: 'trueno_explosion', name: 'Trueno + explosión', color: '#ffb347', icon: '🌩️', seconds: 7, desc: 'Tres rayos cercan al jugador, cae el rayo central y todo estalla.' },
  { id: 'carrusel_creepers', name: 'Carrusel de creepers', color: '#58ff7a', icon: '🎠', seconds: 10, desc: 'Ocho creepers cargados por rayos giran como un tiovivo y se lanzan con explosiones enormes y un gran final.' },
  { id: 'ojo_vacio', name: 'Ojo del vacío', color: '#b15cff', icon: '👁️', seconds: 13, desc: 'Un ojo colosal con párpados y tentáculos se abre en el cielo: todo levita y luego es aplastado.', model: 'ojo_vacio' },
  { id: 'agujero_negro', name: 'Agujero negro', color: '#ff8a1a', icon: '🕳️', seconds: 15, desc: 'Un agujero negro con disco de acreción arranca el terreno en espiral, lo traga todo y colapsa.', model: 'agujero_negro' },
  { id: 'juicio_arcano', name: 'Juicio ígneo', color: '#ff6a1a', icon: '🔥', seconds: 14, desc: 'Magia de fuego: sello y columnas de llamas, lluvia de meteoros y un sol que se comprime sobre el jugador y estalla en una explosión colosal.' },
  { id: 'genkidama', name: 'Genkidama', color: '#8fd3ff', icon: '🔵', seconds: 22, desc: 'El guerrero sube al cielo y pide energía a todos: miles de motas de luz forman una esfera de plasma gigante que lanza contra el objetivo. Con su voz.', model: 'goku' },
  { id: 'meteorito', name: 'Meteorito', color: '#ff6a1a', icon: '☄️', seconds: 18, desc: 'La cámara sube al espacio, una roca incandescente entra y deja un cráter enorme.', model: 'meteorito' },
  { id: 'mil_cortes', name: 'Mil cortes: Templo del mal', color: '#ff3b3b', icon: '⚔️', seconds: 15, desc: 'El rey maldito forma su sello, su templo emerge bajo un cielo carmesí y cientos de tajos de energía cruzan el dominio hasta el corte en cruz. Con su voz.', model: 'sukuna' },
  { id: 'vacio_purpura', name: 'Vacío púrpura', color: '#9b30ff', icon: '🟣', seconds: 21, desc: 'Azul en una mano y rojo en la otra: giran en espiral, se funden en un orbe púrpura con vórtice y rayos, y lo dispara borrando todo a su paso. Con su voz.', model: 'gojo' },
  { id: 'akaza', name: 'Aguja de brújula', color: '#7fd8ff', icon: '❄️', seconds: 20, desc: 'El luchador despliega su brújula de hielo sobre el terreno, embiste con una ráfaga de golpes, eleva al objetivo a puñetazos de aire y lo remata contra el suelo. Con su voz.', model: 'akaza' },
  { id: 'sangre_perforante', name: 'Sangre Perforante', color: '#c0101c', icon: '🩸', seconds: 14, desc: 'Un hechicero de sangre surge del suelo, comprime una esfera de sangre entre las manos y dispara una flecha de sangre que atraviesa al objetivo (ignora parte de la armadura, aplica marchitamiento) y abre una zanja detrás.', model: 'choso' },
  { id: 'ataque_orbital', name: 'Ataque orbital', color: '#ff1a2a', icon: '🛰️', seconds: 14, desc: 'Un rayo rojo fija al objetivo, la cámara sube al espacio (Tierra, Luna y Vía Láctea reales), un satélite cañón carga y dispara un láser colosal que abre un cráter enorme.', model: 'satelite' },
]
