import { normalizarPlaca } from './placa.util';

describe('RN-01 normalizarPlaca', () => {
  it.each([
    ['2345 abc', '2345ABC'],
    ['2345-ABC', '2345ABC'],
    ['  2345abc ', '2345ABC'],
    ['2345ABC', '2345ABC'],
  ])('"%s" → "%s"', (entrada, esperado) => {
    expect(normalizarPlaca(entrada)).toBe(esperado);
  });
});
