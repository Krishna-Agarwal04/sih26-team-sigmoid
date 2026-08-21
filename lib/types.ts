export type InterestTag = "history" | "architecture" | "culture_traditions" | "military" | "religion";
export type Persona = "history" | "architecture" | "kids";
export type Lang = "en" | "hi";
export type NarrationKind = "approach" | "inside";
export type TraditionStatus = "living" | "dormant" | "lost";
export type Importance = 1 | 2 | 3;
export type SiteDepth = "deep" | "shallow";
export type LocationSource = "sim" | "gps";

export type StructureType =
  | "mosque" | "tomb" | "gateway" | "fort_wall" | "palace" | "pavilion"
  | "stepwell" | "caravanserai" | "garden" | "bridge" | "well"
  | "temple" | "madrasa" | "hammam" | "tower" | "other";

export type DistanceUnit = "yards" | "feet" | "miles" | "kos" | "paces" | "gaz";

export type BearingToken =
  | "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW"
  | "adjacent" | "within" | "opposite";

export type CandidateStatus =
  | "extracted" | "geo_resolved" | "candidate"
  | "under_review" | "verified" | "rejected" | "matched_existing";

export type SourceKind = "asi" | "archive" | "book" | "wikipedia";

// [lng, lat], GeoJSON order. Leaflet wants the other way round and gets it from toLeaflet().
export type Coord = [number, number];

export interface Fix {
  lat: number;
  lng: number;
  // null means unknown, which disables the Facing gate rather than blocking it
  headingDeg: number | null;
  accuracyM: number;
  t: number;
  source: LocationSource;
}

export interface RouteStop {
  pointId: string;
  walkSecFromPrevious: number;
  narrationSec: number;
}

export interface Route {
  stops: RouteStop[];
  totalSec: number;
  // Heritage Points that matched the Interest Tags but did not fit the time budget
  droppedPointIds: string[];
}

export interface ThresholdCrossing {
  pointId: string;
  kind: NarrationKind;
  t: number;
}

export interface LivingTradition {
  name: string;
  text: string;
  status: TraditionStatus;
}

export interface ThenNow {
  thenUrl: string;
  nowUrl: string;
  thenCredit: string;
  nowCredit: string;
}

export interface HeritageSite {
  id: string;
  name: string;
  nameLocal?: string;
  depth: SiteDepth;
  period: string;
  centroid: Coord;
  bbox: [number, number, number, number];
  pointIds: string[];
  blurb: string;
  // 0..1, low means under-represented, drives Hidden Heritage
  representationScore: number;
  // "osm:w264863907" where a mapped feature confirms it, "approximate" where nothing does
  coordSource: string;
}

export interface HeritagePoint {
  id: string;
  siteId: string;
  name: string;
  nameLocal?: string;
  tags: InterestTag[];
  importance: Importance;
  zone: GeoJSON.Polygon;
  centroid: Coord;
  livingTradition: LivingTradition | null;
  thenNow?: ThenNow;
}

export interface FactSheetLine {
  id: string;
  text: string;
  source: string;
}

export interface FactSheetSource {
  label: string;
  url?: string;
  kind: SourceKind;
}

export interface FactSheet {
  id: string;
  pointId: string;
  lines: FactSheetLine[];
  sources: FactSheetSource[];
}

export interface Narration {
  pointId: string;
  persona: Persona;
  lang: Lang;
  kind: NarrationKind;
  audioUrl: string;
  durationSec: number;
  sentences: string[];
  // cues[i] is the start time in seconds of sentences[i]
  cues: number[];
  factSheetId: string;
}

// what a writer authors. render-audio.ts supplies the rest of a Narration.
export type NarrationText = Omit<Narration, "audioUrl" | "durationSec" | "cues">;

export interface Anchor {
  id: string;
  name: string;
  aliases: string[];
  centroid: Coord;
  // how tightly the name pins down a spot, in metres
  precisionM: number;
}

export interface SpatialClue {
  anchorName: string;
  bearing: BearingToken;
  distanceValue: number | null;
  distanceUnit: DistanceUnit | null;
}

export interface Mention {
  id: string;
  name: string;
  type: StructureType;
  period: string | null;
  passage: string;
  // char range into the Page text, for highlighting
  passageOffset: [number, number];
  spatialClue: SpatialClue | null;
}

export interface ConfidenceParts {
  sourceReliability: number;
  clueSpecificity: number;
  anchorPrecision: number;
  crossSourceAgreement: number;
  modernEvidence: number;
}

export interface Confidence {
  total: number;
  parts: ConfidenceParts;
}

export interface BaselineMatch {
  id: string;
  name: string;
  distanceM: number;
}

export interface Candidate {
  id: string;
  mentionId: string;
  centroid: Coord;
  uncertaintyRadiusM: number;
  status: CandidateStatus;
  matchedBaselineFeature: BaselineMatch | null;
  confidence: Confidence;
}

export interface CandidateEvent {
  id: number;
  candidateId: string;
  fromStatus: CandidateStatus | null;
  toStatus: CandidateStatus;
  note: string | null;
  actor: string;
  createdAt: string;
}

export interface AnalyseResult {
  source: "live" | "cached";
  modelId: string;
  pageNo: number;
  mentions: Mention[];
  candidates: Candidate[];
}

export interface AskResult {
  answer: string;
  citedLineIds: string[];
  grounded: boolean;
}

export interface WalkCrossingInput {
  walkId: string;
  pointId: string;
  siteId: string;
  persona: Persona;
  kind: NarrationKind;
  locationSource: LocationSource;
}
