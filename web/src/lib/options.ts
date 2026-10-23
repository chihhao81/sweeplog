// Choice lists for the journal form. Stored in the Settings sheet once edited;
// these defaults apply until then and fill in any list added later.

export interface JournalOptions {
  setups: string[]
  liquidity: string[]
  triggers: string[]
  timeframes: string[]
  mistakes: string[]
  grades: string[]
}

export const DEFAULT_OPTIONS: JournalOptions = {
  setups: ['破底翻', '互換', '摸摸', '亂打'],
  liquidity: ['前日高', '前日低', '亞盤高', '亞盤低', '歐盤高', '歐盤低', '等高', '等低', '前週高', '前週低'],
  triggers: ['結構轉換', 'FVG', '吞噬K', 'Pin Bar', '回測確認', '突破'],
  timeframes: ['1m', '3m', '5m', '15m', '1h'],
  mistakes: ['FOMO', '太早進場', '追價', '移動停損', '提早出場', '報復單', '加大部位', '逆勢', '沒等確認', '新聞時段'],
  grades: ['A+', 'A', 'B', 'C'],
}

export const OPTION_LABELS: Record<keyof JournalOptions, string> = {
  setups: 'Setup',
  liquidity: '被掃的流動性',
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
