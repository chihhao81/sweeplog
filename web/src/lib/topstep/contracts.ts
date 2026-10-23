// Dollar value of a one-point move per contract, keyed by root symbol.
const POINT_VALUE: Record<string, number> = {
  MNQ: 2,
  NQ: 20,
  MES: 5,
  ES: 50,
  MYM: 0.5,
  YM: 5,
  M2K: 5,
  RTY: 50,
  MGC: 10,
  GC: 100,
  MCL: 100,
  CL: 1000,
  MBT: 0.1,
  MET: 0.1,
  '6E': 125000,
  M6E: 12500,
}

/** "MNQZ6" → "MNQ" (strips the month code and year digit). */
export function contractRoot(contractName: string): string {
  return contractName.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, '')
}

export function pointValue(contractName: string): number | null {
  return POINT_VALUE[contractRoot(contractName)] ?? null
}
