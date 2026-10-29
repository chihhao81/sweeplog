// Sheet layout. Column order in the spreadsheet follows the order here.
// Column types control cell formats: text columns are stored as plain text so
// Sheets never reinterprets IDs or timestamps.

export type ColumnType = 'text' | 'number' | 'bool'

export interface SheetDef {
  key: string
  columns: Record<string, ColumnType>
}

export const SHEETS = {
  Accounts: {
    key: 'accountName',
    columns: {
      accountName: 'text',
      type: 'text', // Combine | XFA | Live
      startingBalance: 'number',
      maxLossLimit: 'number',
      dailyLossLimit: 'number',
      profitTarget: 'number',
      active: 'bool',
      notes: 'text',
      updatedAt: 'text',
    },
  },

  // One row per Topstep trade (a single filled contract, FIFO-matched).
  Trades: {
    key: 'id',
    columns: {
      id: 'text',
      accountName: 'text',
      positionId: 'text',
      contractName: 'text',
      side: 'text', // Long | Short
      size: 'number',
      enteredAt: 'text',
      exitedAt: 'text',
      entryPrice: 'number',
      exitPrice: 'number',
      pnl: 'number',
      fees: 'number',
      commissions: 'number',
      tradeDay: 'text',
      durationSec: 'number',
      importedAt: 'text',
    },
  },

  Orders: {
    key: 'id',
    columns: {
      id: 'text',
      accountName: 'text',
      contractName: 'text',
      status: 'text',
      type: 'text',
      side: 'text', // Bid = buy, Ask = sell
      size: 'number',
      createdAt: 'text',
      filledAt: 'text',
      cancelledAt: 'text',
      triggeredAt: 'text',
      stopPrice: 'number',
      limitPrice: 'number',
      executePrice: 'number',
      triggeredPrice: 'number',
      positionDisposition: 'text',
      creationDisposition: 'text',
      rejectionReason: 'text',
      tradeDay: 'text',
      importedAt: 'text',
    },
  },

  // One row per position: consecutive trades on the same contract and side
  // that overlap in time (scale-ins / partial exits). This is the journaling unit.
  Positions: {
    key: 'positionId',
    columns: {
      // Derived on import
      positionId: 'text',
      accountName: 'text',
      contractName: 'text',
      side: 'text',
      tradeDay: 'text',
      openedAt: 'text',
      closedAt: 'text',
      session: 'text',
      tradeCount: 'number',
      maxSize: 'number',
      avgEntry: 'number',
      avgExit: 'number',
      grossPnl: 'number',
      costs: 'number',
      netPnl: 'number',
      stopPrice: 'number',
      targetPrice: 'number',
      autoRisk: 'number',
      // Manual (written by the journal form, never by import)
      riskOverride: 'number',
      setup: 'text',
      htfBias: 'text',
      entryTimeframe: 'text',
      entryTrigger: 'text',
      followedPlan: 'bool',
      mistakes: 'text',
      emotionBefore: 'number',
      emotionAfter: 'number',
      grade: 'text',
      notes: 'text',
      lesson: 'text',
      importedAt: 'text',
      updatedAt: 'text',
    },
  },

  DailyJournal: {
    key: 'id', // `${date}|${accountName}`
    columns: {
      id: 'text',
      date: 'text',
      accountName: 'text',
      bias: 'text',
      keyLevels: 'text',
      newsEvents: 'text',
      plan: 'text',
      sleep: 'number',
      energy: 'number',
      followedDailyRules: 'bool',
      wentWell: 'text',
      wentWrong: 'text',
      tomorrow: 'text',
      updatedAt: 'text',
    },
  },

  Screenshots: {
    key: 'id',
    columns: {
      id: 'text',
      date: 'text',
      driveFileId: 'text',
      fileName: 'text',
      caption: 'text',
      takenAt: 'text',
      createdAt: 'text',
    },
  },

  PositionScreenshots: {
    key: 'id', // `${positionId}|${screenshotId}`
    columns: { id: 'text', positionId: 'text', screenshotId: 'text' },
  },

  Settings: {
    key: 'key',
    columns: { key: 'text', value: 'text' },
  },
} as const satisfies Record<string, SheetDef>

export type SheetName = keyof typeof SHEETS

/** Sheets from earlier schema versions, removed on setup if still empty. */
export const RETIRED_SHEETS = ['TradeScreenshots']
