import { describe, expect, it } from 'vitest'
import { GiftCatalog } from '../src/gifts.js'

describe('catálogo de regalos', () => {
  it('encuentra los regalos por su nombre en español (con o sin tildes y signos)', async () => {
    const c = new GiftCatalog()
    await c.init()
    const rose = c.find('Rose')
    expect(rose?.image).toBeTruthy()
    expect(rose?.generic).toBeFalsy()
    // «Rosa» existe también como otro regalo de 10: con el precio se distingue
    expect(c.find('Rosa', 1)?.image).toBe(rose?.image)
    expect(c.find('Eres increíble')?.image).toBe(c.find('You RE Awesome')?.image)
    expect(c.find('Gorra')?.image).toBe(c.find('Cap')?.image)
    expect(c.find('TikTok')?.generic).toBeFalsy()
  })
})
