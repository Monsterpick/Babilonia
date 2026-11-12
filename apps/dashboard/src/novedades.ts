/**
 * Novedades de cada actualización (se enseñan una vez, al entrar después de actualizar).
 * Para una actualización nueva: añade una entrada ARRIBA con el `id` siguiente. Escribe para el streamer, sin jerga.
 */
export interface Novedad {
  id: number
  titulo: string
  fecha: string
  nuevo?: string[]
  mejorado?: string[]
  corregido?: string[]
}

export const NOVEDADES: Novedad[] = [
  {
    id: 4,
    titulo: 'Tops a la izquierda o a la derecha',
    fecha: 'noviembre 2026',
    mejorado: ['Top regalos y Top likes: ahora puedes elegir si van alineados a la izquierda o a la derecha desde sus ajustes en Overlays.'],
  },
  {
    id: 3,
    titulo: 'Actualizaciones más cómodas y overlays más fáciles',
    fecha: 'noviembre 2026',
    nuevo: [
      'Al abrir la app, si hay una versión nueva, aparece una ventana para actualizar: se descarga, se instala sola y la app vuelve a abrirse.',
      'Esta ventana de novedades: después de cada actualización te cuenta qué cambió.',
      'La configuración del overlay de donaciones (enlace, estilo y vista previa) ahora está en Plugins, debajo de tus funciones.',
    ],
    mejorado: [
      'Enlaces de overlays fijos, del tipo http://127.0.0.1:7420/tarjetas.html: los acepta TikTok LIVE Studio y ya no cambian nunca.',
      'Las tarjetas muestran el icono del regalo arriba a la derecha y el nombre de la función abajo.',
    ],
    corregido: [
      'La app ya no se queda colgada en segundo plano al cerrarla: si no abría después de cerrarla para actualizar, era eso.',
      'Si abres la app mientras otra se está cerrando o actualizando, ahora te avisa en vez de no hacer nada.',
      'Las tarjetas a veces salían sin la imagen del regalo (solo con un ★ y el nombre).',
    ],
  },
  {
    id: 2,
    titulo: 'Base Defense táctico, minijuegos nuevos y cinemáticas',
    fecha: 'noviembre 2026',
    nuevo: [
      'Minijuego Dropper: 100 niveles cayendo hasta el agua, con HUD propio.',
      'Minijuego No Salpiques: piscinas con plataformas que se hunden, un monstruo que despierta si tocas el agua, piedras y bengalas, y la crecida final.',
      'Base Defense: armas por piezas con recarga real (el cargador cae y entra uno nuevo), fogonazo, casquillos e inspección con la tecla G (mod 0.10.0).',
      'Perfil «Minecraft Survival Épico» con comandos de survival y todas las cinemáticas.',
      'Catálogo de imágenes de Minecraft para tus funciones y más diseños para el overlay de donaciones.',
    ],
    mejorado: [
      'Base Defense: defiendes a ras de suelo tras una barricada, arena preparada para vertical y dificultad más justa.',
      'El dragón vuela de verdad (órbitas y picados sobre la base) y el Wither se ve a la altura de los ojos; los jefes llevan contorno para verse en el directo.',
      'Mobs infectados con texturas propias (husk, esqueletos y arañas).',
      'Cinemáticas: la flecha de Choso sale cuando dice su frase, escudo pegado al cuerpo y Juicio Ígneo con explosión final.',
    ],
    corregido: [
      'El cañón orbital a veces salía mal: ahora la cámara va sincronizada con el servidor.',
      'Ya se pueden borrar perfiles.',
    ],
  },
]
