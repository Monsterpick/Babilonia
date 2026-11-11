/**
 * LAST HOUSE — lo que comparten los dos modos y lo que la vista necesita para dibujar cualquiera de ellos.
 */
import type { Fx, Guardian, Shot } from './sim'

export type Mode = 'invasion' | 'defensa'

export type ZombieKind = 'caminante' | 'corredor' | 'blindado' | 'excavador' | 'coloso' | 'titan'

export interface ZombieDef {
  name: string
  hp: number
  /** metros por segundo */
  speed: number
  /** daño por segundo a defensas y a la casa */
  dps: number
  radius: number
  /** energía que da al Guardián al caer */
  reward: number
  /** daño recibido ×armor (blindados) */
  armor: number
}

export const ZOMBIES: Record<ZombieKind, ZombieDef> = {
  caminante: { name: 'Caminante', hp: 60, speed: 1.7, dps: 14, radius: 0.45, reward: 4, armor: 1 },
  corredor: { name: 'Corredor', hp: 40, speed: 3.8, dps: 10, radius: 0.4, reward: 5, armor: 1 },
  blindado: { name: 'Blindado', hp: 200, speed: 1.25, dps: 18, radius: 0.55, reward: 10, armor: 0.55 },
  excavador: { name: 'Excavador', hp: 90, speed: 2.6, dps: 16, radius: 0.45, reward: 9, armor: 1 },
  coloso: { name: 'Coloso', hp: 900, speed: 0.95, dps: 55, radius: 1.2, reward: 40, armor: 0.8 },
  titan: { name: 'Titán', hp: 3200, speed: 0.6, dps: 110, radius: 2.0, reward: 150, armor: 0.7 },
}

/** Una unidad de la horda tal como la dibuja la vista (esbirros del Rey o zombis del modo Defensa). */
export interface UnitView {
  id: number
  kind: ZombieKind
  x: number
  z: number
  hp: number
  maxHp: number
  hitAt: number
  /** bajo tierra (excavador): se ve solo el montículo */
  underground: boolean
  owner: string
  /** golpeando algo (animación de ataque) */
  attacking: boolean
  slowed: boolean
}

/** El personaje del streamer tal como lo dibuja la vista. */
export interface HeroView {
  x: number
  z: number
  facing: number
  moving: boolean
  down: boolean
  /** dentro de la casa (asalto conseguido) */
  inside: boolean
  /** recién levantado: parpadea */
  safe: boolean
  dashing: boolean
  /** 0..1 del golpe / disparo en curso (−1 si no) */
  attack: number
  hurt: boolean
  confused: boolean
  slowed: boolean
}

export interface RenderState {
  mode: Mode
  t: number
  phase: 'playing' | 'ended'
  winner: 'rey' | 'guardianes' | 'horda' | 'guardian' | null
  hero: HeroView
  units: UnitView[]
  guardians: Guardian[]
  shots: Shot[]
  /** 0 = día · 1 = noche cerrada (avanza con la partida) */
  night: number
  /** evento de noche de tormenta activo */
  storm: boolean
  /** vida de la casa 0..1 (solo en Defensa) */
  house: number | null
}

export interface Simulation {
  readonly mode: Mode
  render(): RenderState
  drainFx(): Fx[]
}
