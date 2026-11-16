// Choice lists for the journal form. Stored in the Settings sheet once edited;
// these defaults apply until then and fill in any list added later.

export interface JournalOptions {
  setups: string[]
  triggers: string[]
  timeframes: string[]
  mistakes: string[]
  grades: string[]
}

export const DEFAULT_OPTIONS: JournalOptions = {
  setups: ['破底翻', '互換', '摸摸', '亂打'],
  triggers: ['結構轉換', 'FVG', '吞噬K', 'Pin Bar', '回測確認', '突破'],
  timeframes: ['1m', '3m', '5m', '15m', '1h'],
  mistakes: ['FOMO', '太早進場', '追價', '移動停損', '提早出場', '報復單', '加大部位', '逆勢', '沒等確認', '新聞時段'],
  grades: ['A+', 'A', 'B', 'C'],
}

/** What each grade means, shown next to the grade picker. Keyed by the default grade names. */
export const GRADE_LAYERS = '大格局＝位置與趨勢；中格局＝結構；小格局＝進場訊號'
export const GRADE_RULES: { grade: string; rule: string }[] = [
  { grade: 'A+', rule: '大、中、小格局三層都好' },
  { grade: 'A', rule: '大格局好，中、小格局一個好、一個普通' },
  { grade: 'B', rule: '大格局好，但中、小格局都普通；或大格局本身有疑慮' },
  { grade: 'C', rule: '大格局錯（逆勢、不在邊界），或沒照計畫' },
]

export const OPTION_LABELS: Record<keyof JournalOptions, string> = {
  setups: 'Setup',
  triggers: '進場觸發',
  timeframes: '進場週期',
  mistakes: '錯誤標籤',
  grades: '評級',
}

export function withDefaults(stored: Partial<JournalOptions> | null): JournalOptions {
  return { ...DEFAULT_OPTIONS, ...(stored ?? {}) }
}

// Multi-select values are stored in one cell, joined by "、".
const SEP = '、'

export function splitMulti(value: string | null | undefined): string[] {
  return value ? value.split(SEP).filter(Boolean) : []
}

export function joinMulti(values: string[]): string | null {
  return values.length ? values.join(SEP) : null
}
