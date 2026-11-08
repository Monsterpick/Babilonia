/** Galería de comandos: plugin propio LiveArena, Minecraft estándar y tus plugins (MiniLive, s2e-survival). */
export interface GalleryCommand {
  group: 'LiveArena' | 'Minecraft' | 'MiniLive' | 's2e-survival'
  plugin: string
  name: string
  command: string
  usage: string
}

export const GALLERY: GalleryCommand[] = [
 { "group": "LiveArena", "plugin": "LiveArena", "name": "Dar 1 tótem apilable", "command": "la totem add {player} 1 {nickname}", "usage": "Suma tótems al contador (barra en pantalla). Se gastan al morir." },
 { "group": "LiveArena", "plugin": "LiveArena", "name": "Dar tótems según la cantidad", "command": "la totem add {player} {gift.count} {nickname}", "usage": "Una racha de 5 regalos = 5 tótems." },
 { "group": "LiveArena", "plugin": "LiveArena", "name": "Dar 5 tótems", "command": "la totem add {player} 5 {nickname}", "usage": "" },
 { "group": "LiveArena", "plugin": "LiveArena", "name": "Quitar 1 tótem", "command": "la totem remove {player} 1 {nickname}", "usage": "" },
 { "group": "LiveArena", "plugin": "LiveArena", "name": "Poner tótems a 0", "command": "la totem set {player} 0", "usage": "" },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Invocar zombie con nombre",
  "command": "execute at {player} run summon zombie ~2 ~ ~2 {CustomName:'{\"text\":\"{user}\"}',CustomNameVisible:1b}",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Creeper cargado",
  "command": "execute at {player} run summon creeper ~3 ~ ~3 {powered:1b,CustomName:'{\"text\":\"{user}\"}',CustomNameVisible:1b}",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Trueno cerca",
  "command": "execute at {player} run summon lightning_bolt ~2 ~ ~2",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "TNT encendida encima",
  "command": "execute at {player} run summon tnt ~ ~4 ~ {Fuse:50}",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Lluvia de flechas",
  "command": "execute at {player} run summon arrow ~ ~10 ~ {Motion:[0.0,-1.0,0.0]}",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Warden",
  "command": "execute at {player} run summon warden ~5 ~ ~5",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Wither",
  "command": "execute at {player} run summon wither ~ ~5 ~",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Lobo amigo",
  "command": "execute at {player} run summon wolf ~1 ~ ~1 {Owner:\"{player}\",CustomName:'{\"text\":\"{user}\"}'}",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Dar diamantes",
  "command": "give {player} diamond 5",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Dar manzana dorada",
  "command": "give {player} golden_apple 1",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Dar tótem",
  "command": "give {player} totem_of_undying 1",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Comida",
  "command": "give {player} cooked_beef 16",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Curar",
  "command": "effect give {player} instant_health 1 2",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Velocidad 30 s",
  "command": "effect give {player} speed 30 1",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Ceguera 5 s",
  "command": "effect give {player} blindness 5 0",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Levitación 3 s",
  "command": "effect give {player} levitation 3 1",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Lanzar al cielo",
  "command": "execute as {player} at @s run tp @s ~ ~30 ~",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Hacer de noche",
  "command": "time set night",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Hacer de día",
  "command": "time set day",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Tormenta",
  "command": "weather thunder 120",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Vaciar inventario",
  "command": "clear {player}",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Matar mobs de LiveArena",
  "command": "kill @e[tag=livearena]",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Título en pantalla",
  "command": "title {player} title {\"text\":\"{user}\",\"color\":\"gold\"}",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Mensaje en el chat",
  "command": "tellraw @a {\"text\":\"{user} envió {gift}\",\"color\":\"yellow\"}",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Sonido de explosión",
  "command": "execute at {player} run playsound entity.generic.explode master {player} ~ ~ ~ 1 1",
  "usage": ""
 },
 {
  "group": "Minecraft",
  "plugin": "Vanilla",
  "name": "Fuegos artificiales",
  "command": "execute at {player} run summon firework_rocket ~ ~1 ~ {LifeTime:20,FireworksItem:{id:\"firework_rocket\",count:1,components:{}}}",
  "usage": ""
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveAgujero",
  "name": "Agujero negro",
  "command": "agujero {nick} {quien}",
  "usage": "/agujero <jugador> [donador] [clave=valor ...] (titulo, subtitulo, chat, dano, potencia, radio, duracion, camara)"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveAliados",
  "name": "Orbe / mago aliado",
  "command": "aliado {nick} {quien}",
  "usage": "/aliado <jugador> [donador] [tipo=orbe|mago] [duracion=30] [radio=5] [orbita=2.2] [invocador=1] [cantidad=1] [vida=60] [armadura=10] [golpes=2] [mejorado=3] [area=4] [cadencia=1] [alcance=18] [objetivos=monstruos|zombies] [max=10] [chat=\"...\"]  ·  /aliado quitar <jugador>"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveAtomica",
  "name": "Bomba atómica",
  "command": "atomica {nick} {quien}",
  "usage": "/atomica <jugador> [donador] [titulo=.. subtitulo=.. chat=.. potencia=.. radio=..]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveBuda",
  "name": "Buda de las mil manos",
  "command": "buda {nick} {quien}",
  "usage": "/buda <jugador> [donador] [tamano=1] [carga=2.6] [particulas=0] [empuje=0.6] [puno=0.55] [despejar=1] [mobs=1] [golpes=22] [golpe=1] [dano=10] [potencia=0] [matar=0] [totems=0] [romper=1] [noche=1] [subir=1] [max=0] [titulo=\"...\"] [subtitulo=\"...\"] [chat=\"...\"]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveCarcel",
  "name": "Cárcel temporal",
  "command": "carcel {nick} {quien}",
  "usage": "/carcel <jugador> [donador] [duracion=15] [totems=0] [titulo=...] [chat=...] · /carcel restar <jugador> [donador] [segundos=10] [minimo=0] [chat=...]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveCarrusel",
  "name": "Carrusel de creepers",
  "command": "carrusel {nick} {quien}",
  "usage": "/carrusel <jugador> [donador]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveCore",
  "name": "Rayo / planetario",
  "command": "ml rayo {nick} {quien}",
  "usage": "/ml <rayo|planetario> <jugador> [donador] [clave=valor ...] (rayo: titulo, subtitulo, chat, duracion, rayos | planetario: titulo, subtitulo, chat, dano, potencia; caos = nombre antiguo)"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveCortes",
  "name": "Mil cortes divinos",
  "command": "cortes {nick} {quien}",
  "usage": "/cortes <jugador> [donador] [tamano=1] [duracion=6] [cortes=18] [dps=5] [dano=10] [potencia=4] [matar=0] [totems=0] [romper=1] [despejar=1] [noche=1] [subir=1] [max=0] [titulo=\"...\"] [subtitulo=\"...\"] [chat=\"...\"]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveCruz",
  "name": "Cruz de luz (Raya)",
  "command": "cruz {nick} {quien}",
  "usage": "/cruz <jugador> [donador] [titulo=&e&l[RAYA]] [subtitulo=&a&oLa luz te sigue] [chat=\"&e{donador} lanzó Raya → {jugador}\"] [potencia=5.8]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveCubo",
  "name": "Reto del cubo",
  "command": "cubo crear 9 {nick}",
  "usage": "/cubo crear [lado] [jugador] | /cubo quitar | /cubo estado | /cubo traer [jugador]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveCubo",
  "name": "Cubo: poner bloques",
  "command": "cuboponer {nick} {quien}",
  "usage": "/cuboponer <jugador> [donador] [cantidad=5] [bloque=...]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveCubo",
  "name": "Cubo: quitar bloques",
  "command": "cuboquitar {nick} {quien}",
  "usage": "/cuboquitar <jugador> [donador] [cantidad=5]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveCubo",
  "name": "Cubo: TNT",
  "command": "cubotnt {nick} {quien}",
  "usage": "/cubotnt <jugador> [donador] [radio=3]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveCubo",
  "name": "Cubo: borrar capa",
  "command": "cubocapa {nick} {quien}",
  "usage": "/cubocapa <jugador> [donador]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveCubo",
  "name": "cubollenar",
  "command": "cubollenar {nick} {quien}",
  "usage": "/cubollenar <jugador> [donador] [bloque=...]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveCubo",
  "name": "cubovaciar",
  "command": "cubovaciar {nick} {quien}",
  "usage": "/cubovaciar <jugador> [donador]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveCubo",
  "name": "cubodar",
  "command": "cubodar {nick} {quien}",
  "usage": "/cubodar <jugador> [donador] [cantidad=64] [bloque=...]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveDragon",
  "name": "Dragones encadenados",
  "command": "dragon {nick} {quien}",
  "usage": "/dragon <jugador> [donador] [dragones=3] [dps=0.5] [duracion=6] [titulo=\"...\"] [subtitulo=\"...\"] [chat=\"...\"] [final=\"...\"]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveEscudo",
  "name": "Escudo de energía",
  "command": "escudo {nick} {quien}",
  "usage": "/escudo <jugador> [donador] [vida=50 tope=10 duracion=0 tamano=1 sumar=1 titulo= subtitulo= chat=] | /escudo quitar <jugador>"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveEsfera",
  "name": "Hakai (esfera)",
  "command": "hakai {nick} {quien}",
  "usage": "/hakai <jugador> [donador] [dps=4] [duracion=3] [max=0] [titulo=\"...\"] [subtitulo=\"...\"] [chat=\"...\"] [final=\"...\"]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveEspada",
  "name": "Corona de espadas",
  "command": "corona {nick} {quien}",
  "usage": "/corona <jugador> [donador] [titulo=.. subtitulo=.. chat=.. potencia=..]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveEsqueleto",
  "name": "La Parca",
  "command": "esqueleto {nick} {quien}",
  "usage": "/esqueleto <jugador> [donador] [tamano=20] [carga=4] [dano=20] [potencia=6] [explosiones=10] [matar=1] [totems=20] [max=0] [noche=1] [mirar=0] [pentagrama=1] [titulo=\"...\"] [subtitulo=\"...\"] [chat=\"...\"] [despejar=1] [permanente=0] [subir=1]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveJuicio",
  "name": "Juicio Arcano",
  "command": "juicio {nick} {quien}",
  "usage": "/juicio <jugador> [donador] [tamano=1] [carga=5] [rayo=8] [dano=30] [danoimpacto=6] [danorayo=2] [rayomata=1] [porcentaje=0] [totems=0] [matar=0] [empuje=2] [romper=1] [permanente=1] [noche=1] [camara=1] [subir=1] [texturas=1] [max=0] [titulo=\"...\"] [subtitulo=\"...\"] [chat=\"...\"]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveKit",
  "name": "Kit inicial",
  "command": "kit dar {nick}",
  "usage": "/kit dar <jugador> | /kit recargar | /kit ver | /kit vision [on|off] | /kit salto [0-10] | /kit caida [on|off] | /kit objetos [on|off]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLivePain",
  "name": "Pain (Shinra Tensei)",
  "command": "pain {nick} {quien}",
  "usage": "/pain <jugador> [donador] [clave=valor ...] (dano, totems, tamano, radio, cine, permanente, espera, chat)"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveRinnegan",
  "name": "Ojo Rinnegan",
  "command": "rinnegan {nick} {quien}",
  "usage": "/rinnegan <jugador> [donador] [tamano=1.5] [carga=3] [duracion=6] [llama=1] [dps=3] [totems=0] [romper=0] [noche=1] [max=0] [titulo=\"...\"] [subtitulo=\"...\"] [chat=\"...\"]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveSagitario",
  "name": "Arquero de Sagitario",
  "command": "sagitario {nick} {quien}",
  "usage": "/sagitario <jugador> [donador] [tamano=5] [flechas=3] [cadencia=2.5] [potencia=7] [explosiones=4] [dano=8] [matar=0] [totems=0] [romper=1] [noche=1] [subir=1] [max=0] [titulo=\"...\"] [subtitulo=\"...\"] [chat=\"...\"]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveSol",
  "name": "Sol cruel (titán)",
  "command": "solcruel {nick} {quien}",
  "usage": "/solcruel <jugador> [donador] [tamano=18] [carga=8] [sol=28] [duracion=5] [golpes=5] [dps=6] [dano=10] [matar=0] [totems=0] [romper=1] [cielo=1] [max=0] [titulo=\"...\"] [subtitulo=\"...\"] [chat=\"...\"] [despejar=1] [permanente=0] [subir=1] [liso=1]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveSuperRayo",
  "name": "Súper rayo",
  "command": "superrayo {nick} {quien}",
  "usage": "/superrayo <jugador> [donador] [titulo=&4&l[SUPER RAYO]] [subtitulo=&7&oEl cielo se apaga] [tituloFinal=&f&l¡SUPER RAYO!] [chat=\"&c{donador} lanzó Super rayo → {jugador}\"] [dano=8] [potencia=6]"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveTotems",
  "name": "Tótems apilables",
  "command": "totems dar {nick} 5",
  "usage": "/totems dar <jugador> [cantidad] [cantidad=N] [aviso=0/1] [sonido=0/1] [juntar=0/1] | /totems juntar <jugador> | /totems limite | /totems contador [on|off] [barra|accion|lateral|cabeza] | /totems avisos [on|off] | /totems cuantos <jugador>"
 },
 {
  "group": "MiniLive",
  "plugin": "MiniLiveTrueno",
  "name": "Trueno + explosión",
  "command": "trueno {nick} {quien}",
  "usage": "/trueno <jugador> [donador] [clave=valor ...] (titulo, subtitulo, chat, potencia, rayos)"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Manzana dorada encantada",
  "command": "survival apple_enchanted {nickname}",
  "usage": "/survival apple_enchanted <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Arco con Infinity",
  "command": "survival bow {nickname}",
  "usage": "/survival bow <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Espada aleatoria con Sharpness 3",
  "command": "survival random_sword {nickname}",
  "usage": "/survival random_sword <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Totem de la Inmortalidad",
  "command": "survival totem {nickname}",
  "usage": "/survival totem <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Armadura aleatoria con Protection 3",
  "command": "survival random_armor {nickname}",
  "usage": "/survival random_armor <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Herramientas de netherite",
  "command": "survival tools {nickname}",
  "usage": "/survival tools <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "10 carnes cocinadas aleatorias",
  "command": "survival random_food {nickname}",
  "usage": "/survival random_food <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "16 perlas de ender",
  "command": "survival enderpearls {nickname}",
  "usage": "/survival enderpearls <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Spawnea creeper apuntando al jugador",
  "command": "survival creeper {nickname}",
  "usage": "/survival creeper <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Spawnea evoker",
  "command": "survival evoker {nickname}",
  "usage": "/survival evoker <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Spawnea ghast",
  "command": "survival ghast {nickname}",
  "usage": "/survival ghast <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Creeper cargado",
  "command": "survival creeper_charged {nickname}",
  "usage": "/survival creeper_charged <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Boss aleatorio",
  "command": "survival random_boss {nickname}",
  "usage": "/survival random_boss <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Esqueleto",
  "command": "survival skeleton {nickname}",
  "usage": "/survival skeleton <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Bruja",
  "command": "survival witch {nickname}",
  "usage": "/survival witch <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Zombie con armadura",
  "command": "survival zombie null {nickname}",
  "usage": "/survival zombie <armor> <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Abeja",
  "command": "survival bee {nickname}",
  "usage": "/survival bee <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Blaze",
  "command": "survival blaze {nickname}",
  "usage": "/survival blaze <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Ravager",
  "command": "survival ravager {nickname}",
  "usage": "/survival ravager <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Piglin",
  "command": "survival piglin {nickname}",
  "usage": "/survival piglin <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Pozo personalizado",
  "command": "survival pit 3 5 {nickname}",
  "usage": "/survival pit <width> <height> <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Limpia inventario",
  "command": "survival clear_inventory {nickname}",
  "usage": "/survival clear_inventory <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Jaula de telarañas 4x4",
  "command": "survival trap {nickname}",
  "usage": "/survival trap <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Mata jugadores",
  "command": "survival kill {nickname}",
  "usage": "/survival kill <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Rayos a todos los jugadores",
  "command": "survival lightning {nickname}",
  "usage": "/survival lightning <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Raid completa",
  "command": "survival raid {nickname}",
  "usage": "/survival raid <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Caja de TNT con creepers",
  "command": "survival tntbox {nickname}",
  "usage": "/survival tntbox <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Teletransporta 200 bloques arriba con cubo de agua",
  "command": "survival water_drop {nickname}",
  "usage": "/survival water_drop <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Jaula de bloques de miel con abejas",
  "command": "survival bee_cage {nickname}",
  "usage": "/survival bee_cage <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Caja de obsidiana",
  "command": "survival obsidian_box {nickname}",
  "usage": "/survival obsidian_box <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Congela movimiento 10 segundos",
  "command": "survival stopmove {nickname}",
  "usage": "/survival stopmove <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Pozo de lava",
  "command": "survival lavapit {nickname}",
  "usage": "/survival lavapit <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Araña",
  "command": "survival spider {nickname}",
  "usage": "/survival spider <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Zombie gigante",
  "command": "survival zombiegiant {nickname}",
  "usage": "/survival zombiegiant <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "TNT configurable",
  "command": "survival tnt 60 4 5 {nickname}",
  "usage": "/survival tnt <timer> <force> <radius> <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Oculta banner",
  "command": "survival hidebanner",
  "usage": "/survival hidebanner"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Inicia objetivo",
  "command": "survival start timer 5",
  "usage": "/survival start <timer/zombie/sheep> <minutes/count>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Detiene objetivos",
  "command": "survival stop",
  "usage": "/survival stop"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Spawnea Wither",
  "command": "survival wither",
  "usage": "/survival wither"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Spawnea Warden",
  "command": "survival warden",
  "usage": "/survival warden"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Perro amigable",
  "command": "survival dog",
  "usage": "/survival dog"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Establece armadura y espada por defecto",
  "command": "survival set",
  "usage": "/survival set"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Cancela pérdida de hambre",
  "command": "survival regeneat",
  "usage": "/survival regeneat"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Cofre con loot estándar",
  "command": "survival chest",
  "usage": "/survival chest"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Cofre con loot raro",
  "command": "survival chest_super",
  "usage": "/survival chest_super"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Toggle efectos de spawn",
  "command": "survival chest-effect",
  "usage": "/survival chest-effect"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Mob aleatorio (con bosses) en radio",
  "command": "survival armob 5 {nickname}",
  "usage": "/survival armob <radius> <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Mob aleatorio (sin bosses) en radio",
  "command": "survival rmob 5 {nickname}",
  "usage": "/survival rmob <radius> <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Aumenta velocidad",
  "command": "survival speed 30",
  "usage": "/survival speed <seconds>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Aumenta salto",
  "command": "survival jump_boost 30",
  "usage": "/survival jump_boost <seconds>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Aumenta daño",
  "command": "survival strength 30",
  "usage": "/survival strength <seconds>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Regenera salud",
  "command": "survival regeneration 30",
  "usage": "/survival regeneration <seconds>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Jinetes de esqueleto",
  "command": "survival skeleton_trap",
  "usage": "/survival skeleton_trap"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Meteoritos",
  "command": "survival meteors 5 {nickname}",
  "usage": "/survival meteors <count> <name>"
 },
 {
  "group": "s2e-survival",
  "plugin": "s2e-survival",
  "name": "Prisión",
  "command": "survival prison 30",
  "usage": "/survival prison <time>"
 }
]
