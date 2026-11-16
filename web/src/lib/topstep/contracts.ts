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

// Minimum price increment per contract, keyed by root symbol.
const TICK_SIZE: Record<string, number> = {
  MNQ: 0.25,
  NQ: 0.25,
  MES: 0.25,
  ES: 0.25,
  MYM: 1,
  YM: 1,
  M2K: 0.1,
  RTY: 0.1,
  MGC: 0.1,
  GC: 0.1,
  MCL: 0.01,
  CL: 0.01,
  MBT: 5,
  MET: 0.5,
  '6E': 0.00005,
  M6E: 0.0001,
}

export function tickSize(contractName: string): number | null {
  return TICK_SIZE[contractRoot(contractName)] ?? null
}
