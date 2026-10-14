import { create } from 'zustand';

export interface LocationData {
  address: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  propertyType: 'residential' | 'commercial';
  coordinates?: { lat: number; lng: number };
}

export interface DiagnosisResult {
  condition_name: string;
  confidence: number;
  severity: 'low' | 'moderate' | 'high';
  explanation: string;
  actions: { priority: string; text: string; color?: string }[];
}

export interface SavedDiagnosis {
  id: string;
  condition_name: string;
  confidence: number;
  severity: string;
  image_url: string | null;
  diagnosis_json: DiagnosisResult;
  symptoms?: string[] | null;
  description?: string | null;
  location_json?: LocationData | null;
  created_at: string;
}

interface DiagnosisState {
  capturedImage: string | null;
  remoteImageUrl: string | null;
  selectedTags: string[];
  description: string;
  location: LocationData | null;
  result: DiagnosisResult | null;
  historyPreview: SavedDiagnosis | null;
  setHistoryPreview: (diagnosis: SavedDiagnosis | null) => void;
  restoreDiagnosis: (diagnosis: SavedDiagnosis) => void;
  
  setCapturedImage: (uri: string) => void;
  setRemoteImageUrl: (url: string) => void;
  setContext: (tags: string[], desc: string) => void;
  setLocation: (loc: LocationData) => void;
  setResult: (res: DiagnosisResult) => void;
  resetSession: () => void;
}

export const useDiagnosisStore = create<DiagnosisState>((set) => ({
  capturedImage: null,
  remoteImageUrl: null,
  selectedTags: [],
  description: '',
  location: null,
  result: null,
  historyPreview: null,
  setHistoryPreview: (historyPreview) => set({ historyPreview }),
  restoreDiagnosis: (diagnosis) => set({
    capturedImage: null,
    remoteImageUrl: diagnosis.image_url,
    result: diagnosis.diagnosis_json,
    selectedTags: diagnosis.symptoms || [],
    description: diagnosis.description || '',
    location: diagnosis.location_json || null,
  }),

  setCapturedImage: (uri) => set({ capturedImage: uri }),
  setRemoteImageUrl: (url) => set({ remoteImageUrl: url }),
  setContext: (tags, description) => set({ selectedTags: tags, description }),
  setLocation: (location) => set({ location }),
  setResult: (result) => set({ result }),
  resetSession: () => set({
    capturedImage: null,
    remoteImageUrl: null,
    selectedTags: [],
    description: '',
    location: null,
    result: null,
  }),
}));
