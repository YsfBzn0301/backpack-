/**
 * Road, toll and parking-zone rules per country, used by SafetyAgent and the
 * Parking screen. Stored as codes so every UI language can phrase them
 * (strings live under `road.*` in the locale files). General guidance only:
 * local signs always win.
 */
export type ZoneColor = 'blue' | 'white' | 'yellow' | 'green' | 'red' | 'orange' | 'purple'
export type ZoneMeaning = 'paid' | 'free' | 'residents' | 'reserved' | 'disc' | 'noParking' | 'noStopping' | 'shortStay' | 'loading' | 'pickup' | 'timeLimited' | 'mixed'
export type TollKind = 'none' | 'vignette' | 'toll' | 'electronic' | 'mixed'
export type RuleNote =
  | 'lez'
  | 'critair'
  | 'ztl'
  | 'ulez'
  | 'noRightOnRed'
  | 'rightOnRed'
  | 'discCommon'
  | 'payByApp'
  | 'plateEntry'
  | 'headlightsDay'
  | 'coinParking'
  | 'pSigns'
  | 'winterTyres'
  | 'kurzpark'
  | 'hgs'
  | 'congestion'
  | 'atVignette'
  | 'chVignette'
  | 'eVignette'
  | 'peage'
  | 'ptTolls'
  | 'ieM50'
  | 'dartford'
  | 'etoll'
  | 'autopass'
  | 'dkBridges'
  | 'usTolls'
  | 'auTolls'
  | 'jpEtc'
  | 'nlSpeed'
  | 'deNoLimit'
  | 'zonesSms'

export interface RoadRules {
  drive: 'right' | 'left'
  /** urban, rural, motorway (null where there's no general limit). */
  speed: [number, number, number | null]
  unit: 'kmh' | 'mph'
  toll: TollKind
  zones: [ZoneColor, ZoneMeaning][]
  notes: RuleNote[]
}

const R = (drive: RoadRules['drive'], speed: RoadRules['speed'], toll: TollKind, zones: RoadRules['zones'], notes: RuleNote[], unit: RoadRules['unit'] = 'kmh'): RoadRules => ({
  drive,
  speed,
  unit,
  toll,
  zones,
  notes,
})

export const ROAD_RULES: Record<string, RoadRules> = {
  DE: R('right', [50, 100, null], 'none', [['blue', 'disc']], ['deNoLimit', 'lez', 'discCommon', 'noRightOnRed', 'winterTyres']),
  AT: R('right', [50, 100, 130], 'vignette', [['blue', 'shortStay']], ['atVignette', 'kurzpark', 'payByApp', 'winterTyres']),
  CH: R('right', [50, 80, 120], 'vignette', [['blue', 'disc'], ['white', 'paid'], ['yellow', 'reserved']], ['chVignette', 'discCommon']),
  IT: R('right', [50, 90, 130], 'toll', [['blue', 'paid'], ['white', 'free'], ['yellow', 'reserved']], ['ztl', 'headlightsDay', 'payByApp']),
  FR: R('right', [50, 80, 130], 'toll', [['blue', 'disc']], ['peage', 'critair', 'payByApp']),
  ES: R('right', [50, 90, 120], 'mixed', [['blue', 'shortStay'], ['green', 'residents'], ['yellow', 'noParking']], ['payByApp', 'lez']),
  PT: R('right', [50, 90, 120], 'electronic', [['blue', 'paid']], ['ptTolls', 'payByApp']),
  NL: R('right', [50, 80, 100], 'none', [['blue', 'disc']], ['nlSpeed', 'plateEntry', 'payByApp', 'lez']),
  BE: R('right', [50, 70, 120], 'none', [['blue', 'disc']], ['lez', 'discCommon', 'payByApp']),
  PL: R('right', [50, 90, 140], 'mixed', [], ['etoll', 'payByApp', 'headlightsDay']),
  CZ: R('right', [50, 90, 130], 'vignette', [['blue', 'residents'], ['orange', 'shortStay'], ['purple', 'mixed']], ['eVignette', 'headlightsDay', 'payByApp']),
  SK: R('right', [50, 90, 130], 'vignette', [], ['eVignette', 'headlightsDay']),
  HU: R('right', [50, 90, 130], 'vignette', [], ['eVignette', 'headlightsDay', 'zonesSms']),
  SI: R('right', [50, 90, 130], 'vignette', [['blue', 'shortStay']], ['eVignette', 'headlightsDay']),
  HR: R('right', [50, 90, 130], 'toll', [], ['zonesSms', 'headlightsDay']),
  RO: R('right', [50, 90, 130], 'vignette', [], ['eVignette', 'headlightsDay']),
  BG: R('right', [50, 90, 140], 'vignette', [['blue', 'shortStay'], ['green', 'paid']], ['eVignette', 'headlightsDay', 'zonesSms']),
  GR: R('right', [50, 90, 130], 'toll', [['blue', 'paid'], ['white', 'free'], ['yellow', 'reserved']], ['payByApp']),
  TR: R('right', [50, 90, 120], 'electronic', [], ['hgs', 'headlightsDay']),
  GB: R('left', [30, 60, 70], 'mixed', [['yellow', 'noParking'], ['red', 'noStopping']], ['dartford', 'ulez', 'congestion', 'payByApp'], 'mph'),
  IE: R('left', [50, 80, 120], 'mixed', [['yellow', 'noParking']], ['ieM50', 'discCommon', 'payByApp']),
  NO: R('right', [50, 80, 110], 'electronic', [], ['autopass', 'headlightsDay', 'winterTyres']),
  SE: R('right', [50, 70, 120], 'electronic', [], ['congestion', 'headlightsDay', 'winterTyres', 'payByApp']),
  DK: R('right', [50, 80, 130], 'mixed', [], ['dkBridges', 'discCommon', 'headlightsDay']),
  FI: R('right', [50, 80, 120], 'none', [], ['discCommon', 'headlightsDay', 'winterTyres']),
  US: R('right', [30, 55, 70], 'electronic', [['red', 'noStopping'], ['yellow', 'loading'], ['white', 'pickup'], ['green', 'timeLimited'], ['blue', 'reserved']], ['usTolls', 'rightOnRed'], 'mph'),
  CA: R('right', [50, 80, 100], 'mixed', [], ['rightOnRed', 'winterTyres']),
  AU: R('left', [50, 100, 110], 'electronic', [], ['auTolls', 'pSigns']),
  NZ: R('left', [50, 100, 100], 'electronic', [], ['pSigns']),
  JP: R('left', [40, 60, 100], 'toll', [], ['jpEtc', 'coinParking', 'noRightOnRed']),
  TH: R('left', [80, 90, 120], 'mixed', [['red', 'noParking'], ['yellow', 'shortStay']], []),
}

export const getRoadRules = (code?: string | null) => (code ? ROAD_RULES[code.toUpperCase()] : undefined)
